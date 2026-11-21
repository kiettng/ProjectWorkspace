import 'server-only';
import { NextResponse } from 'next/server';
import { serverClient } from './supabase/server';
import { z } from 'zod';
import { sameRequestOrigin } from './request-origin';

export class ApiError extends Error { constructor(message:string,public status=400){super(message);} }
export async function requireOwner(request?:Request) {
  if(request && !['GET','HEAD'].includes(request.method)) {
    if(!sameRequestOrigin(request)) throw new ApiError('Nguồn yêu cầu không hợp lệ.',403);
  }
  const db=await serverClient();
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user) throw new ApiError('Vui lòng đăng nhập.',401);
  const owner=process.env.OWNER_EMAIL?.toLowerCase();
  if(!owner || user.email?.toLowerCase()!==owner || !user.email_confirmed_at) throw new ApiError('Tài khoản không có quyền truy cập.',403);
  if(process.env.OWNER_USER_ID && user.id!==process.env.OWNER_USER_ID) throw new ApiError('Tài khoản không có quyền truy cập.',403);
  return {db,user};
}
export function check<T>(result:{data:T;error:{message:string}|null},allowNull:true):T;
export function check<T>(result:{data:T;error:{message:string}|null},allowNull?:false):NonNullable<T>;
export function check<T>(result:{data:T;error:{message:string}|null},allowNull=false):T {
  if(result.error) throw new ApiError(result.error.message);
  if(result.data===null&&!allowNull) throw new ApiError('Không tìm thấy dữ liệu được yêu cầu.',404);
  return result.data;
}
export function apiError(error:unknown) {
  if(error instanceof z.ZodError) return NextResponse.json({error:error.issues.map(i=>i.message).join(' · ')},{status:400});
  if(error instanceof ApiError) return NextResponse.json({error:error.message},{status:error.status});
  console.error('Dossier request failed:',error instanceof Error?error.name:'UnknownError');
  return NextResponse.json({error:'Không thể hoàn tất yêu cầu. Vui lòng thử lại.'},{status:500});
}
export const uuid=z.string().uuid();
export const date=z.union([z.iso.date(),z.literal(''),z.null()]).optional();
export const name=z.string().trim().min(1,'Vui lòng nhập đủ thông tin bắt buộc.').max(300);
