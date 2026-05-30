# First Project Walkthrough

**Goal**: Create a simple web app using AgenticOS in under 5 minutes.

## Step 1: Set Up a Provider

1. Open AgenticOS
2. Go to **Settings → Providers**
3. Click **Add Provider** → select **OpenAI**
4. Enter your API key
5. Click **Test Connection** → should show "Connected"
6. Click **Save**

## Step 2: Assign the Provider

1. Go to **Settings → Roles**
2. For the **manager** role, select your provider and model
3. For the **coder** role, select the same provider
4. Close settings

## Step 3: Create a Project

1. Click **File → Open Workspace**
2. Create a new folder or select an existing one
3. The file explorer shows your project structure

## Step 4: Send a Message

Type in the chat panel:

```
Create a simple HTML page with a button that turns the background blue when clicked.
Save it as index.html.
```

## What Should Happen

1. The **execution header** appears showing provider + model name
2. The **phase timeline** shows: Routing → Thinking → tool calls
3. A **tool call card** appears: `write_file`
4. A **file edit card** shows the content being written
5. The **response** confirms the file was created
6. The file appears in the file explorer

## Step 5: Verify the Result

1. Click on `index.html` in the file explorer
2. The Monaco editor opens the file
3. Check that the HTML is correct
4. If you have a browser tool enabled, ask the agent to preview it

## Step 6: Iterate

```
Add some CSS styling to make it look modern. Use a gradient background.
```

## Expected Time

- Provider setup: 2 minutes
- First response: 30 seconds
- Full project creation: 3-5 minutes

## Tips

- Start with simple requests and gradually increase complexity
- Use "fastest" mode for quick iterations
- Use "most_accurate" mode for quality-critical tasks
- The system remembers conversation context within a session
- You can open and read files during execution

## Next Steps

- Try multi-file projects
- Experiment with different execution modes
- Set up MCP servers for additional tools
- Configure multiple agents for complex tasks
