import { NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ username: null }, { status: 400 });
  }
  if (!NEYNAR_API_KEY) {
    return NextResponse.json({ username: null });
  }

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,
      { headers: { "x-api-key": NEYNAR_API_KEY }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json({ username: null });

    const data = await res.json();
    const users = data[address.toLowerCase()];
    const username = users?.[0]?.username ?? null;
    return NextResponse.json({ username });
  } catch {
    return NextResponse.json({ username: null });
  }
}
