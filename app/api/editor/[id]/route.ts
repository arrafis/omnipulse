import {NextResponse} from "next/server";
import {database,categories,safeUrl,type Category} from "@/lib/content";
import {canEdit,sameOrigin} from "@/lib/editor-auth";
export const runtime="edge";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(req)||!await canEdit(req))return NextResponse.json({error:"Editor access required"},{status:403});
 const {id}=await params;if(!/^\d+$/.test(id))return NextResponse.json({error:"Invalid story"},{status:400});
 const x=await req.json().catch(()=>null) as Record<string,unknown>|null;
 if(!x||typeof x.title!=="string"||x.title.trim().length<8||x.title.length>150||typeof x.summary!=="string"||x.summary.trim().length<30||x.summary.length>350||typeof x.body!=="string"||x.body.trim().length<180||x.body.length>20000||!categories.includes(x.category as Category)||!safeUrl(String(x.sourceUrl))||typeof x.sourceName!=="string"||x.sourceName.trim().length<3||x.sourceName.length>100||!['draft','published'].includes(String(x.status)))return NextResponse.json({error:"Complete the article and provide an HTTPS source"},{status:400});
 const previous=await database().prepare("SELECT published_at FROM articles WHERE id=?").bind(Number(id)).first<{published_at:string|null}>();
 if(!previous)return NextResponse.json({error:"Story not found"},{status:404});
 const now=new Date().toISOString();
 await database().prepare("UPDATE articles SET title=?,summary=?,body=?,category=?,source_url=?,source_name=?,status=?,updated_at=?,published_at=? WHERE id=?").bind(x.title.trim(),x.summary.trim(),x.body.trim(),x.category,safeUrl(String(x.sourceUrl)),x.sourceName.trim(),x.status,now,x.status==='published'?(previous.published_at||now):null,Number(id)).run();
 return NextResponse.json({saved:true});
}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(req)||!await canEdit(req))return NextResponse.json({error:"Editor access required"},{status:403});
 const {id}=await params;if(!/^\d+$/.test(id))return NextResponse.json({error:"Invalid story"},{status:400});
 await database().prepare("DELETE FROM articles WHERE id=?").bind(Number(id)).run();return NextResponse.json({deleted:true});
}
