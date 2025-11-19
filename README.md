Observify — Minimal full project (runnable locally, no Mongo required)

Quick start:
1) Start backend:
   cd backend
   npm install
   npm start
   # backend at http://localhost:4000

2) Serve client test page:
   cd client-sdk
   npx http-server . -p 5500
   # open http://127.0.0.1:5500/test.html

3) Open dashboard:
   open dashboard/index.html in browser (or serve it) and click Refresh

This package is intended for testing and demo only. Replace JSON store with MongoDB for production.
