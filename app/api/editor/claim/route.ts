import {NextResponse} from "next/server";
import {claimEditor,sameOrigin} from "@/lib/editor-auth";
export const runtime="edge";
export async function POST(req:Request){if(!sameOrigin(req)||!await claimEditor(req))return NextResponse.json({error:"Only the site owner can activate the newsroom"},{status:403});return NextResponse.json({editor:true});}
