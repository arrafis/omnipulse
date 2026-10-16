import {NextResponse} from "next/server";
import {database} from "@/lib/content";
import {canEdit} from "@/lib/editor-auth";
export const runtime="edge";
export async function GET(req:Request){if(!await canEdit(req))return NextResponse.json({error:"Editor access required"},{status:403});const subscribers=(await database().prepare("SELECT email,consent_at,confirmed_at,premium_interest FROM subscribers ORDER BY consent_at DESC LIMIT 5000").all<{email:string;consent_at:string;confirmed_at:string|null;premium_interest:number}>()).results;return NextResponse.json({subscribers});}
