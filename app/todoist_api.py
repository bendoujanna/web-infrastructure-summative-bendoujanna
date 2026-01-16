import requests
import os

TODOIST_API_TOKEN = os.getenv("TODOIST_API_TOKEN")
HEADERS = {
    "Authorization": f"Bearer {TODOIST_API_TOKEN}",
    "Content-Type": "application/json"
}

response = requests.get("https://api.todoist.com/rest/v2/tasks", headers=headers)
tasks = response.json()
print(tasks)