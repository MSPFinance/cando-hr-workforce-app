// Shared developer audit authorization. Never trust a browser-supplied email alone.
export async function verifyDeveloper(req) {
  const base=(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
  const anon=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
  const allowed=new Set((process.env.APPLICATION_USAGE_ALLOWED_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean));
  const secret=(process.env.APPLICATION_USAGE_ACCESS_TOKEN||"").trim();
  const bearer=String(req.headers.authorization||"").match(/^Bearer\s+(.+)$/i)?.[1];
  const supplied=String(req.headers["x-usage-access-token"]||"").trim();
  if(!base||!anon||!secret||!allowed.size||!bearer||supplied!==secret)return null;
  const response=await fetch(base+"/auth/v1/user",{headers:{apikey:anon,Authorization:"Bearer "+bearer},cache:"no-store"});
  if(!response.ok)return null;
  const user=await response.json();
  const email=String(user?.email||"").trim().toLowerCase();
  if(!user?.id||!allowed.has(email))return null;
  return {id:user.id,email};
}
