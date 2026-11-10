import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";

export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: "/login/" })(request);
}

export const config = { matcher: ["/leader/:path*"] };
