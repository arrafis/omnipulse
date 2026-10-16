import { NextResponse } from "next/server";
import { authorizedJob, deliverDigest, newsletterConfigured } from "@/lib/newsletter";
export const runtime="edge";
export async function POST(req:Request){
 if(!authorizedJob(req.headers.get("authorization")))return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!newsletterConfigured())return NextResponse.json({error:"Newsletter delivery is not configured"},{status:503});
 try{return NextResponse.json(await deliverDigest());}
 catch(error){console.error("Newsletter run failed",error);return NextResponse.json({error:"Newsletter run failed"},{status:503});}
}
