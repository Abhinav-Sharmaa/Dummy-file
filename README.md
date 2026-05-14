When an MCP server connects, it doesn’t just expose tools blindly. Each tool comes with a description that tells the AI:
	•	What the tool is called (e.g. send_email)
	•	What it does (“Sends an email to a recipient”)
	•	What inputs it needs (recipient address, subject, body)
	•	When to use it
The AI reads these descriptions and figures out which tool fits the task. So if you say “email Sarah the Q1 numbers,” the AI scans its available tools, sees send_email matches, picks it, and fills in the right inputs.
A simple analogy: it’s like a toolbox where every tool has a label explaining its job. The AI doesn’t randomly grab a hammer when you need a screwdriver — it reads the labels and picks the right one.
This is also why tool descriptions matter so much. A poorly described MCP tool (“does stuff with data”) will get ignored or misused. A well-described one (“queries the customer database by email address, returns order history”) gets picked correctly every time.
So yes — MCP doesn’t just connect tools, it helps the AI understand what each tool is for and when to reach for it.
