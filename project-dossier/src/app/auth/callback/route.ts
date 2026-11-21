import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
export async function GET(request:Request) {
 const url=new URL(request.url),code=url.searchParams.get('code');
 const next=url.searchParams.get('next')==='/reset-password'?'/reset-password':'/';
 if(code){const db=await serverClient();const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(next,url.origin));}
 return NextResponse.redirect(new URL('/login?error=callback',url.origin));
}
