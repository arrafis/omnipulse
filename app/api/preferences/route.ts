import { NextResponse } from "next/server";
import { database } from "@/lib/content";
import { sameOrigin } from "@/lib/editor-auth";
import { preferencesSubscriber } from "@/lib/newsletter";
export const runtime="edge";
export async function POST(req:Request){
 if(!sameOrigin(req))return NextResponse.json({error:"Invalid request origin"},{status:403});
 const data=await req.json().catch(()=>null) as {token?:unknown;categories?:unknown;deliveryHour?:unknown}|null;
 const token=data?.token;
 const categories=data?.categories;
 if(typeof token!=="string"||!Array.isArray(categories)||categories.length<1||categories.length>3||!categories.every(x=>typeof x==="string"&&["AI","Tech","Markets"].includes(x))||new Set(categories).size!==categories.length)return NextResponse.json({error:"Select at least one topic"},{status:400});
 const hour=data?.deliveryHour;
 if(hour!==undefined&&(!Number.isInteger(hour)||Number(hour)<8||Number(hour)>12))return NextResponse.json({error:"Choose a delivery hour between 8 AM and noon Eastern"},{status:400});
 const subscriber=await preferencesSubscriber(token);
 if(!subscriber)return NextResponse.json({error:"This link has expired. Use the link in a newer email."},{status:403});
 await database().prepare("UPDATE subscribers SET preferred_categories=?,delivery_hour=? WHERE id=? AND confirmed_at IS NOT NULL").bind(categories.join(","),hour===undefined?subscriber.delivery_hour:Number(hour),subscriber.id).run();
 return NextResponse.json({saved:true});
}
