import { createClient } from '@supabase/supabase-js';

// 1. Supabase 프로젝트 URL과 익명 키를 입력하세요.
// 실제 프로덕션에서는 환경 변수 등을 사용하는 것이 안전합니다.
const supabaseUrl = 'https://dmokfjfloupvxvqkioha.supabase.co'; // 여기에 Supabase URL을 입력하세요.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtb2tmamZsb3Vwdnh2cWtpb2hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0Mjc4NTgsImV4cCI6MjA3MjAwMzg1OH0.fEtsqwj0GovlXq6dItgdfefe2SziihEVTOPtamUOvhQ'; // 여기에 Supabase 익명 키를 입력하세요.

// 2. Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseKey);
