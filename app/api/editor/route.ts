import { NextResponse } from "next/server";
import { database, categories, safeUrl, slugify, type Article, type Category } from "@/lib/content";
import { canEdit, identity, sameOrigin } from "@/lib/editor-auth";
export const runtime="edge";
export async function GET(req:Request){
 const person=identity(req);
 if(!person)return NextResponse.json({authenticated:false,editor:false,articles:[]});
 const editor=await canEdit(req);
 if(!editor)return NextResponse.json({authenticated:true,editor:false,articles:[]});
 const articles=(await database().prepare("SELECT * FROM articles ORDER BY updated_at DESC LIMIT 100").all<Article>()).results;
 return NextResponse.json({authenticated:true,editor:true,articles});
}
export async function POST(req:Request){
 if(!sameOrigin(req)||!await canEdit(req))return NextResponse.json({error:"Editor access required"},{status:403});
 const input=await req.json().catch(()=>null);
 if(!input||typeof input!=="object")return NextResponse.json({error:"Invalid article"},{status:400});
 const {title,summary,body,category,sourceUrl,sourceName,status}=input as Record<string,unknown>;
 if(typeof title!=="string"||title.trim().length<8||title.length>150||typeof summary!=="string"||summary.trim().length<30||summary.length>350||typeof body!=="string"||body.trim().length<180||body.length>20000||!categories.includes(category as Category)||!safeUrl(String(sourceUrl))||typeof sourceName!=="string"||sourceName.trim().length<3||sourceName.length>100||!['draft','published'].includes(String(status))){return NextResponse.json({error:"Complete the title, summary, article, category, and HTTPS source before saving"},{status:400});}
 const slug=slugify(title);if(!slug)return NextResponse.json({error:"Title needs Latin letters or numbers for its URL"},{status:400});
 const now=new Date().toISOString();
 try{const row=await database().prepare("INSERT INTO articles (slug,title,summary,body,category,source_url,source_name,status,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id").bind(slug,title.trim(),summary.trim(),body.trim(),category,safeUrl(String(sourceUrl)),sourceName.trim(),status,now,now,status==='published'?now:null).first<{id:number}>();
 return NextResponse.json({id:row?.id,slug},{status:201});}
 catch{return NextResponse.json({error:"Could not save; a story with this title may already exist"},{status:409});}
}
