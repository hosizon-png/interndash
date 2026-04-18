# InternDash Deployment (Render + Atlas + Vercel)

## 1) Deploy backend to Render

1. Push this project to GitHub.
2. In Render, create a **Web Service** from this repo.
3. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variables:
   - `PORT=10000` (or leave Render default)
   - `MONGO_URI=<your atlas connection string>`
   - `CLIENT_ORIGIN=<your vercel frontend url>`

After deploy, copy backend URL, e.g. `https://interndash-api.onrender.com`.

## 2) Create MongoDB Atlas database

1. Create a free cluster.
2. Create DB user/password.
3. In Network Access, allow your server IP (or `0.0.0.0/0` for quick setup).
4. Copy connection string:
   - `mongodb+srv://<user>:<password>@.../interndash?retryWrites=true&w=majority`
5. Put it into Render `MONGO_URI`.

## 3) Deploy frontend to Vercel

1. Import this repo in Vercel.
2. Framework preset: **Other**.
3. Output: static root (no build command needed).
4. Deploy and copy frontend URL, e.g. `https://interndash.vercel.app`.

## 4) Point frontend to backend API

Open deployed frontend in browser and run this once in DevTools Console:

```js
localStorage.setItem('INTERNDASH_API_BASE', 'https://interndash-api.onrender.com/api');
location.reload();
```

## 5) Verify

- Open `https://interndash.vercel.app`
- Check:
  - Job list loads
  - Board works
  - Forum works
  - "查看详情" opens company pages

