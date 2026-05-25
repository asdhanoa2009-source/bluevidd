import express from "express";
import multer from "multer";
import path from "path";

const app = express();
const BASE = "/bluevid";
// PORT is now only defined once at the bottom

app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ======================
    STORAGE
====================== */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

/* ======================
    DATA
====================== */
let users = [];
let posts = [];
let currentUser = null;

/* ======================
    FRONTEND (The HTML part)
====================== */
app.get(BASE, (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BlueVid</title>
<style>
body { margin:0; font-family:Arial; background:#111; color:#fff }
header { background:#000; padding:12px; text-align:center; border-bottom:1px solid #333 }
nav { display:flex; background:#000; position:fixed; bottom:0; width:100%; border-top:1px solid #333 }
nav button { flex:1; padding:15px; border:none; background:#000; color:#fff }
nav button:hover { background:#222 }
.page { display:none; padding:15px; padding-bottom:80px }
.active { display:block }
input { width:100%; padding:12px; margin:8px 0; background:#222; border:1px solid #444; color:#fff; border-radius:4px; }
button.primary { width:100%; padding:12px; background:#2979ff; color:#fff; border:none; border-radius:4px; font-weight:bold; }
.post { border-bottom:1px solid #333; padding:15px 0 }
video { width:100%; max-height:400px; border-radius:8px; background:#000 }
.msg { text-align:center; color:#4da3ff; margin-top:8px }
.avatar { width:80px; height:80px; background:#2979ff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:bold; margin:10px auto; }
.logout { background:#333; color:#4da3ff; border:1px solid #444; padding:10px; width:100%; border-radius:4px; }
</style>
</head>
<body>
<header><h2>BlueVid</h2></header>
<div id="auth" class="page active">
  <input id="auth_user" placeholder="Username">
  <button class="primary" onclick="signup()">Sign Up</button>
  <button class="primary" style="margin-top:8px" onclick="login()">Log In</button>
  <p id="auth_msg" class="msg"></p>
</div>
<div id="feed" class="page"><div id="posts"></div></div>
<div id="upload" class="page">
  <input type="file" id="videoFile" accept="video/*">
  <input id="caption" placeholder="Caption">
  <button class="primary" onclick="uploadVideo()">Post Video</button>
  <p id="upload_msg" class="msg"></p>
</div>
<div id="profile" class="page"><div id="profileData"></div></div>
<nav>
  <button onclick="show('feed')">Home</button>
  <button onclick="show('upload')">Create</button>
  <button onclick="show('profile')">Profile</button>
</nav>
<script>
const API = "${BASE}";
function show(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if(id==="feed") loadFeed();
  if(id==="profile") loadProfile();
}
async function signup(){
  const r = await fetch(API+"/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:auth_user.value})});
  auth_msg.innerText = (await r.json()).message;
}
async function login(){
  const r = await fetch(API+"/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:auth_user.value})});
  const d = await r.json();
  d.success ? show("feed") : auth_msg.innerText=d.message;
}
async function logout(){ await fetch(API+"/logout",{method:"POST"}); show("auth"); }
async function loadFeed(){
  const d = await (await fetch(API+"/feed")).json();
  posts.innerHTML = d.length ? d.map(p=>\`
    <div class="post">
      <b>@\${p.user}</b>
      <video src="\${p.video}" controls></video>
      <p>\${p.caption}</p>
      <button onclick="like('\${p.id}')">💙 \${p.likes}</button>
    </div>\`).join("") : "<p>No videos yet</p>";
}
async function like(id){ await fetch(API+"/like/"+id,{method:"POST"}); loadFeed(); }
async function uploadVideo(){
  if(!videoFile.files[0]){ upload_msg.innerText="Select a video"; return; }
  const f=new FormData();
  f.append("video",videoFile.files[0]);
  f.append("caption",caption.value);
  const r=await fetch(API+"/upload",{method:"POST",body:f});
  r.ok ? show("feed") : upload_msg.innerText="Log in first";
}
async function loadProfile(){
  const d=await (await fetch(API+"/me")).json();
  if(!d.user){ profileData.innerHTML="<p>Please log in</p>"; return; }
  profileData.innerHTML=\`
    <div class="avatar">\${d.user[0].toUpperCase()}</div>
    <h3>@\${d.user}</h3>
    <p>\${d.posts.length} posts</p>
    <button class="logout" onclick="logout()">Log Out</button>
  \`;
}
</script>
</body>
</html>
`);
});

/* ======================
    API ROUTES
====================== */
app.post(BASE+"/signup",(req,res)=>{
  if(!req.body.username) return res.json({message:"Missing username"});
  if(users.includes(req.body.username)) return res.json({message:"Taken"});
  users.push(req.body.username);
  res.json({message:"Signup successful"});
});

app.post(BASE+"/login",(req,res)=>{
  if(users.includes(req.body.username)){
    currentUser=req.body.username;
    return res.json({success:true});
  }
  res.json({success:false,message:"Not found"});
});

app.post(BASE+"/logout",(req,res)=>{currentUser=null;res.json({});});

app.post(BASE+"/upload",upload.single("video"),(req,res)=>{
  if(!currentUser) return res.status(401).end();
  posts.unshift({
    id:Date.now().toString(),
    user:currentUser,
    video:"/uploads/"+req.file.filename,
    caption:req.body.caption||"",
    likes:0
  });
  res.json({});
});

app.get(BASE+"/feed",(req,res)=>res.json(posts));
app.post(BASE+"/like/:id",(req,res)=>{const p=posts.find(x=>x.id===req.params.id);if(p)p.likes++;res.json({});});
app.get(BASE+"/me",(req,res)=>res.json({user:currentUser,posts:posts.filter(p=>p.user===currentUser)}));

/* ======================
    START SERVER
====================== */
const PORT = process.env.PORT || 3000; 
app.get("/test", (req, res) => {
  res.send("<h1>The server is working!</h1>");
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`BlueVid is running at http://localhost:\${PORT}\${BASE}`);
}); w