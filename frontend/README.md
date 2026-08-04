# Frontend Module (frontend/)

React-based user interface enabling responsive upload, dashboard visualization, and report configuration.

## Directory Responsibilities
- Render the main user interface with responsive layouts (desktop & mobile).
- Handle drag-and-drop file upload interactions.
- Communicate with the FastAPI backend endpoints to upload files and fetch dashboard data.
- Draw interactive data visualization charts (bar, pie, summary metrics).

## File Mapping
- `package.json`: Manages npm package dependencies and build scripts.
- `index.html`: Entry-point HTML file.
- `src/main.jsx`: Mounts the React application.
- `src/App.jsx`: Root component coordinating navigation between Upload and Dashboard.
- `src/components/Upload.jsx`: Drag-and-drop file submission component with upload progress.
- `src/components/Dashboard.jsx`: Layout displaying metrics, filters, and records table.
- `src/components/Charts.jsx`: Component using a charting library (e.g., Plotly or lightweight charting wrapper) to visualize metrics.
- `src/styles/style.css`: General layout, color definitions, and standard styles.
- `src/styles/responsive.css`: CSS media queries for full mobile compatibility.
