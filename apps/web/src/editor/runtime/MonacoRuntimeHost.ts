import type { editor, IDisposable } from "monaco-editor"

export interface ModelDescriptor {
  uri: string
  language: string
  content: string
  version: number
}

export interface EditOperation {
  range: [number, number, number, number]
  text: string
  forceMoveMarkers?: boolean
}

type ModelChangeCallback = (uri: string, model: ModelDescriptor) => void

export class MonacoRuntimeHost {
  private models = new Map<string, editor.ITextModel>()
  private listeners = new Set<ModelChangeCallback>()
  private changeDisposables = new Map<string, IDisposable>()
  private static instance: MonacoRuntimeHost

  static getInstance(): MonacoRuntimeHost {
    if (!MonacoRuntimeHost.instance) {
      MonacoRuntimeHost.instance = new MonacoRuntimeHost()
    }
    return MonacoRuntimeHost.instance
  }

  private constructor() {}

  registerModel(uri: string, model: editor.ITextModel): void {
    const existing = this.models.get(uri)
    if (existing === model) return

    this.changeDisposables.get(uri)?.dispose()
    this.models.set(uri, model)

    const disposable = model.onDidChangeContent(() => {
      this.emitChange(uri)
    })
    this.changeDisposables.set(uri, disposable)
    this.emitChange(uri)
  }

  unregisterModel(uri: string): void {
    this.changeDisposables.get(uri)?.dispose()
    this.changeDisposables.delete(uri)
    this.models.delete(uri)
  }

  getModel(uri: string): editor.ITextModel | undefined {
    return this.models.get(uri)
  }

  getDescriptor(uri: string): ModelDescriptor | null {
    const model = this.models.get(uri)
    if (!model) return null
    return {
      uri,
      language: model.getLanguageId(),
      content: model.getValue(),
      version: model.getVersionId(),
    }
  }

  applyEdit(uri: string, edit: EditOperation): void {
    const model = this.models.get(uri)
    if (!model) return
    model.pushEditOperations(
      null,
      [
        {
          range: {
            startLineNumber: edit.range[0],
            startColumn: edit.range[1],
            endLineNumber: edit.range[2],
            endColumn: edit.range[3],
          },
          text: edit.text,
          forceMoveMarkers: edit.forceMoveMarkers,
        },
      ],
      () => null,
    )
  }

  applyEdits(uri: string, edits: EditOperation[]): void {
    const model = this.models.get(uri)
    if (!model) return
    model.pushEditOperations(
      null,
      edits.map((e) => ({
        range: {
          startLineNumber: e.range[0],
          startColumn: e.range[1],
          endLineNumber: e.range[2],
          endColumn: e.range[3],
        },
        text: e.text,
        forceMoveMarkers: e.forceMoveMarkers,
      })),
      () => null,
    )
  }

  renameModel(uri: string, newUri: string): void {
    const model = this.models.get(uri)
    if (!model) return
    this.changeDisposables.get(uri)?.dispose()
    this.changeDisposables.delete(uri)
    this.models.delete(uri)
    this.models.set(newUri, model)
    const disposable = model.onDidChangeContent(() => {
      this.emitChange(newUri)
    })
    this.changeDisposables.set(newUri, disposable)
    this.emitChange(uri)
    this.emitChange(newUri)
  }

  subscribe(callback: ModelChangeCallback): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  clear(): void {
    for (const disposable of this.changeDisposables.values()) {
      disposable.dispose()
    }
    this.changeDisposables.clear()
    this.models.clear()
    this.listeners.clear()
  }

  private emitChange(uri: string): void {
    const descriptor = this.getDescriptor(uri)
    if (!descriptor) return
    for (const cb of this.listeners) {
      cb(uri, descriptor)
    }
  }
}
