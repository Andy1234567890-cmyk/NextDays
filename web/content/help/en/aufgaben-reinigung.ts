import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Tasks & Cleaning",
  description: "Organize cleaning schedules and team tasks.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Operations",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Creating Tasks",
          excerpt: "How to create a new task for a property or a date range.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Tasks bring together everything that needs to be done around a property — from cleaning after check-out to maintenance work or guest requests. Each task is linked to exactly one property and can be assigned to a team member.",
            },
            { type: "h2", text: "Creating a New Task" },
            {
              type: "steps",
              items: [
                "Open the “Tasks” section in the main menu.",
                "Click “New Task”.",
                "Select the relevant property.",
                "Enter a title and, optionally, a description.",
                "Set the due date and time.",
                "Save the task.",
              ],
            },
            { type: "h2", text: "Task Types" },
            {
              type: "p",
              text: "In addition to freely created tasks, there are system-generated tasks, such as cleanings automatically scheduled after a check-out. These are already linked to the property and the appropriate time slot and only need to be assigned to a team member.",
            },
            {
              type: "ul",
              items: [
                "Manual task: created freely, e.g. maintenance or a special request.",
                "Automatic cleaning task: derived from the check-out date.",
                "Recurring task: for regular checks or inspections.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "For details on automatic scheduling, see [Cleaning Schedules](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Use precise titles — in the mobile view, team members often only see the title and the property at a glance.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Cleaning Schedules",
          excerpt: "Have cleanings scheduled automatically after check-out.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "A cleaning schedule ensures that a cleaning task is automatically created for the relevant property after every check-out — without you having to track each booking individually. This reduces missed handovers and ensures a reliable process between stays.",
            },
            { type: "h2", text: "Enabling Automatic Scheduling" },
            {
              type: "steps",
              items: [
                "Open the property and switch to the “Cleaning” tab.",
                "Enable “Automatically schedule cleaning after check-out”.",
                "Define how much time after check-out is allotted for cleaning.",
                "Optionally set a default team or default cleaner.",
                "Save the setting.",
              ],
            },
            { type: "h2", text: "Interaction with the Calendar" },
            {
              type: "p",
              text: "As soon as a booking is canceled or moved, the associated cleaning task automatically adjusts to the new check-out date. This keeps the cleaning schedule always in sync with the actual occupancy status.",
            },
            {
              type: "ul",
              items: [
                "A cleaning task is created automatically for every check-out with an active schedule.",
                "If the booking moves, the cleaning task moves with it.",
                "If a guest cancels the stay, the cleaning task is removed.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Without an active cleaning schedule, no automatic tasks are created — in that case, create cleanings manually under [Creating Tasks](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Assigning Tasks",
          excerpt: "Assign tasks specifically to cleaners or team members.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "For a task to get done, assign it to a specific team member — for example, a cleaner or a staff member responsible for maintenance. By default, only the assigned person sees the task in their own overview.",
            },
            { type: "h2", text: "Assigning a Task Manually" },
            {
              type: "steps",
              items: [
                "Open the task in the “Tasks” list.",
                "Click “Assign”.",
                "Select the responsible team member from the list.",
                "Confirm the assignment.",
              ],
            },
            { type: "h2", text: "Assignment by Property" },
            {
              type: "p",
              text: "If a cleaner is already permanently assigned to a property, you can also have tasks for that property automatically assigned to that person. This saves clicks for recurring cleanings and reduces follow-up questions.",
            },
            {
              type: "ul",
              items: [
                "Manual assignment: you choose the person for each task yourself.",
                "Fixed property assignment: new tasks for this property automatically go to the stored person.",
                "A task always has exactly one responsible person.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Cleaners and staff members only see their own assigned tasks, not the property's financial or sales data.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Tracking Task Status",
          excerpt: "Keep track of task progress in real time.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Every task moves through a clear status — from open to in progress to completed. This lets you see at any time whether a cleaning or maintenance job will be finished in time for the next check-in.",
            },
            { type: "h2", text: "Status Overview" },
            {
              type: "ul",
              items: [
                "Open: the task has been created but not yet started.",
                "In progress: the assigned person has started the task.",
                "Completed: the task is done and confirmed.",
              ],
            },
            { type: "h2", text: "Updating the Status" },
            {
              type: "steps",
              items: [
                "Open the task from the “Tasks” list.",
                "Select the appropriate status, e.g. “In Progress” or “Completed”.",
                "If needed, add a short note, for example about anything unusual at the property.",
                "Save the change.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Status changes appear immediately in the shared task list — no manual reload is needed.",
            },
            {
              type: "note",
              variant: "warn",
              text: "If a cleaning is still open shortly before the next check-in, check the assignment first before contacting the guest.",
            },
          ],
        },
      ],
    },
  ],
};
