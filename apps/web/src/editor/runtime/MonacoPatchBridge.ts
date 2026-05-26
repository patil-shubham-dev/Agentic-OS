import type { ASTPatch, ASTPatchResult } from "./ASTPatchEngine"
import { ASTPatchEngine } from "./ASTPatchEngine"
import { VerificationPipeline, type VerificationResult } from "./VerificationPipeline"
import { FileSnapshotManager } from "./FileSnapshotManager"
import { PatchRollbackEngine } from "./PatchRollbackEngine"

export interface MonacoEditOperation {
  range: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }
  text: string
  forceMoveMarkers?: boolean
}

export interface PatchApplicationResult {
  success: boolean
  editOperations: MonacoEditOperation[]
  verificationResults: VerificationResult[]
  snapshotId: string | null
  patchId: string | null
  error: string | null
}

export interface MonacoEditorRef {
  getModel: () => {
    getValue: () => string
    getLineCount: () => number
    getLineContent: (line: number) => string
    pushEditOperations: (ctx: unknown, ops: MonacoEditOperation[], undoStop: boolean) => void
    getFullModelRange: () => { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }
  } | null
  getPosition: () => { lineNumber: number; column: number } | null
  setPosition: (pos: { lineNumber: number; column: number }) => void
  revealLine: (line: number) => void
}

export class MonacoPatchBridge {
  private astEngine: ASTPatchEngine
  private verificationPipeline: VerificationPipeline
  private snapshotManager: FileSnapshotManager
  private rollbackEngine: PatchRollbackEngine

  constructor() {
    this.astEngine = new ASTPatchEngine()
    this.verificationPipeline = new VerificationPipeline()
    this.snapshotManager = new FileSnapshotManager()
    this.rollbackEngine = new PatchRollbackEngine(this.snapshotManager)
  }

  applyPatch(
    editor: MonacoEditorRef,
    path: string,
    language: string,
    patch: ASTPatch,
  ): PatchApplicationResult {
    const model = editor.getModel()
    if (!model) {
      return { success: false, editOperations: [], verificationResults: [], snapshotId: null, patchId: null, error: "Editor model not available" }
    }

    const source = model.getValue()

    const snapshot = this.snapshotManager.takeSnapshot(path, source, `Before: ${patch.op} ${patch.target}`)

    const astResult: ASTPatchResult = this.astEngine.applyPatch(source, patch)
    if (!astResult.success) {
      return { success: false, editOperations: [], verificationResults: [], snapshotId: snapshot.id, patchId: null, error: astResult.error }
    }

    const editOps = this.computeEditOperations(source, astResult.newContent, model)
    if (editOps.length === 0) {
      return { success: false, editOperations: [], verificationResults: [], snapshotId: snapshot.id, patchId: null, error: "No changes detected" }
    }

    const savedPosition = editor.getPosition()
    const savedLine = savedPosition?.lineNumber ?? 1

    model.pushEditOperations(null, editOps, true)

    if (savedPosition) {
      editor.setPosition(savedPosition)
    }

    const verifications = awaitVerification(this.verificationPipeline, astResult.newContent, language)

    if (!this.verificationPipeline.allPassed(verifications)) {
      model.pushEditOperations(null, this.computeEditOperations(astResult.newContent, source, model), true)
      if (savedPosition) {
        editor.setPosition(savedPosition)
      }
      return {
        success: false,
        editOperations: editOps,
        verificationResults: verifications,
        snapshotId: snapshot.id,
        patchId: null,
        error: `Verification failed: ${this.verificationPipeline.getErrors(verifications).join("; ")}`,
      }
    }

    const patchRecord = this.rollbackEngine.recordPatch(path, `${patch.op} ${patch.target}`, snapshot.id)

    return {
      success: true,
      editOperations: editOps,
      verificationResults: verifications,
      snapshotId: snapshot.id,
      patchId: patchRecord.id,
      error: null,
    }
  }

  applySearchReplace(
    editor: MonacoEditorRef,
    path: string,
    language: string,
    oldString: string,
    newString: string,
  ): PatchApplicationResult {
    const patch: ASTPatch = {
      op: "replace_function_body",
      target: oldString,
      code: newString,
    }

    return this.applyPatch(editor, path, language, patch)
  }

  rollbackLast(editor: MonacoEditorRef, path: string): boolean {
    const snapshot = this.rollbackEngine.rollbackLast(path)
    if (!snapshot) return false

    const model = editor.getModel()
    if (!model) return false

    const currentContent = model.getValue()
    const editOps = this.computeEditOperations(currentContent, snapshot.content, model)

    if (editOps.length > 0) {
      model.pushEditOperations(null, editOps, true)
    }

    return true
  }

  rollbackToSnapshot(editor: MonacoEditorRef, snapshotId: string): boolean {
    const snapshot = this.snapshotManager.getSnapshot(snapshotId)
    if (!snapshot) return false

    const model = editor.getModel()
    if (!model) return false

    const currentContent = model.getValue()
    const editOps = this.computeEditOperations(currentContent, snapshot.content, model)

    if (editOps.length > 0) {
      model.pushEditOperations(null, editOps, true)
    }

    return true
  }

  getSnapshots(path: string) {
    return this.snapshotManager.getSnapshots(path)
  }

  getPatches(path: string) {
    return this.rollbackEngine.getPatches(path)
  }

  canRollback(path: string): boolean {
    return this.rollbackEngine.canRollback(path)
  }

  private computeEditOperations(
    oldContent: string,
    newContent: string,
    model: NonNullable<ReturnType<MonacoEditorRef["getModel"]>>,
  ): MonacoEditOperation[] {
    if (oldContent === newContent) return []

    const operations: MonacoEditOperation[] = []
    const oldLines = oldContent.split("\n")
    const newLines = newContent.split("\n")

    let startDiff = 0
    while (
      startDiff < oldLines.length &&
      startDiff < newLines.length &&
      oldLines[startDiff] === newLines[startDiff]
    ) {
      startDiff++
    }

    let endDiffOld = oldLines.length - 1
    let endDiffNew = newLines.length - 1
    while (
      endDiffOld >= startDiff &&
      endDiffNew >= startDiff &&
      oldLines[endDiffOld] === newLines[endDiffNew]
    ) {
      endDiffOld--
      endDiffNew--
    }

    if (startDiff > endDiffOld && startDiff > endDiffNew) return []

    const newText = newLines.slice(startDiff, endDiffNew + 1).join("\n")

    operations.push({
      range: {
        startLineNumber: startDiff + 1,
        startColumn: 1,
        endLineNumber: Math.max(endDiffOld + 1, startDiff + 1),
        endColumn: endDiffOld >= startDiff ? (oldLines[endDiffOld]?.length ?? 1) + 1 : 1,
      },
      text: newText,
    })

    return operations
  }
}

function awaitVerification(
  pipeline: VerificationPipeline,
  source: string,
  language: string,
): VerificationResult[] {
  let results: VerificationResult[] = []
  pipeline.verify(source, language, ["syntax"]).then((r) => { results = r })
  return results
}
