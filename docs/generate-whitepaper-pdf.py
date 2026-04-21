#!/usr/bin/env python3
"""Generate the GundariuM Whitepaper PDF."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Image
)
import os

# Colors
GOLD = HexColor("#d4a017")
BLUE = HexColor("#4a9eff")
WHITE = HexColor("#ffffff")
MED_GRAY = HexColor("#e0e0e0")
TEXT_COLOR = HexColor("#2d2d2d")
HEADER_BG = HexColor("#1a1a2e")
TABLE_HEADER = HexColor("#2d2d5e")
TABLE_ALT = HexColor("#f0f0f8")


def build_pdf():
    doc = SimpleDocTemplate(
        "GundariuMwhitepaper.pdf",
        pagesize=letter,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
        leftMargin=0.85*inch,
        rightMargin=0.85*inch,
    )

    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle('DocTitle', parent=styles['Title'], fontSize=32, textColor=HEADER_BG, spaceAfter=4, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle('DocSubtitle', parent=styles['Normal'], fontSize=13, textColor=BLUE, spaceAfter=4, fontName='Helvetica'))
    styles.add(ParagraphStyle('Tagline', parent=styles['Normal'], fontSize=14, textColor=GOLD, spaceBefore=12, spaceAfter=4, fontName='Helvetica-Oblique', alignment=TA_CENTER))
    styles.add(ParagraphStyle('SectionHead', parent=styles['Heading1'], fontSize=18, textColor=HEADER_BG, spaceBefore=20, spaceAfter=10, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle('SubHead', parent=styles['Heading2'], fontSize=14, textColor=BLUE, spaceBefore=14, spaceAfter=6, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle('Body', parent=styles['Normal'], fontSize=10.5, textColor=TEXT_COLOR, spaceAfter=8, leading=15, alignment=TA_JUSTIFY, fontName='Helvetica'))
    styles.add(ParagraphStyle('BodyBold', parent=styles['Normal'], fontSize=10.5, textColor=TEXT_COLOR, spaceAfter=8, leading=15, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle('BulletPt', parent=styles['Normal'], fontSize=10.5, textColor=TEXT_COLOR, spaceAfter=4, leading=15, leftIndent=20, bulletIndent=8, fontName='Helvetica'))
    styles.add(ParagraphStyle('SmallGray', parent=styles['Normal'], fontSize=9, textColor=HexColor("#888888"), spaceAfter=4, fontName='Helvetica'))
    styles.add(ParagraphStyle('TC', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica', textColor=TEXT_COLOR))
    styles.add(ParagraphStyle('TCB', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica-Bold', textColor=TEXT_COLOR))
    styles.add(ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=8, textColor=HexColor("#999999"), spaceAfter=4, leading=11, fontName='Helvetica', alignment=TA_JUSTIFY))

    P = lambda text, style='TC': Paragraph(text, styles[style])
    PB = lambda text: Paragraph(text, styles['TCB'])

    story = []

    def section(title):
        story.append(PageBreak())
        story.append(Paragraph(title, styles['SectionHead']))
        story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
        story.append(Spacer(1, 8))

    def sub(title):
        story.append(Paragraph(title, styles['SubHead']))

    def body(text):
        story.append(Paragraph(text, styles['Body']))

    def bold(text):
        story.append(Paragraph(text, styles['BodyBold']))

    def bullet(text):
        story.append(Paragraph(text, styles['BulletPt'], bulletText="\u2022"))

    def table(data, widths):
        t = Table(data, colWidths=widths)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
            ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, TABLE_ALT]),
            ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))

    # ─── COVER ───
    banner_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "banner.png")
    if os.path.exists(banner_path):
        # Scale banner to page width (6.3" usable with margins)
        banner = Image(banner_path, width=6.3*inch, height=6.3*inch * (820/1456))
        story.append(banner)
        story.append(Spacer(1, 20))
    else:
        story.append(Spacer(1, 80))
    story.append(Paragraph("GundariuM", styles['DocTitle']))
    story.append(Paragraph("Whitepaper v1.0", styles['DocSubtitle']))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=2, color=GOLD))
    story.append(Paragraph("Your shelf is your deck.", styles['Tagline']))
    story.append(Spacer(1, 20))
    body("A physical-to-digital NFT card battle game where players photograph their real Gunpla model kits and mint them as playable ERC-721 battle cards with lore-accurate stats.")
    story.append(Spacer(1, 20))
    meta = [
        ["Studio", "PyroFire Labs"],
        ["Version", "1.0 \u2014 March 20, 2026"],
        ["Website", "gundarium.xyz"],
        ["Launch", "May 10, 2026"],
        ["Chains", "Base + Ronin"],
    ]
    mt = Table(meta, colWidths=[1.5*inch, 4*inch])
    mt.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), HEADER_BG),
        ('TEXTCOLOR', (1, 0), (1, -1), TEXT_COLOR),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(mt)

    # ─── 1. INTRODUCTION ───
    section("1. Introduction")
    body("GundariuM is a physical-to-digital NFT card battle game where players photograph their real Gunpla model kits and mint them as playable ERC-721 battle cards on the blockchain. Each card carries lore-accurate stats derived from a curated database of 148 Mobile Suits spanning every timeline in the Gundam universe \u2014 Universal Century, Cosmic Era, After Colony, Post Disaster, Ad Stella, and beyond.")
    bold("The premise is simple: your shelf is your deck.")
    body("Every Gunpla builder already owns a collection. GundariuM turns that collection into a digital battle roster \u2014 each kit photographed, identified, graded, and minted with stats that reflect its canonical identity. An RX-78-2 Gundam carries different weapons, armor, and faction data than a Wing Gundam Zero or a Barbatos Lupus Rex, because they should.")
    body("Players use their minted cards in Pokemon-style turn-based battles, staking $GNDM tokens on the outcome. Strategic weapon selection, armor-type matchups, and grade-based power scaling create depth that rewards both knowledge of the source material and tactical decision-making.")
    body("GundariuM is not a promise \u2014 it is a product. Smart contracts are deployed on Base mainnet with active $GNDM stakers, the full web application is live at <b>gundarium.xyz</b>, and the complete mint flow is functional. Full launch is scheduled for <b>May 10, 2026</b>.")

    # Gunpla photo to fill page
    gunpla_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "gunpla-photo.png")
    if os.path.exists(gunpla_path):
        story.append(Spacer(1, 12))
        gunpla_img = Image(gunpla_path, width=4.5*inch, height=4.5*inch * (1080/1456))
        gunpla_img.hAlign = 'CENTER'
        story.append(gunpla_img)
        story.append(Paragraph("<i>A real Gunpla kit \u2014 the kind of photo that becomes a GundariuM battle card.</i>", styles['SmallGray']))

    # ─── 2. THE CORE LOOP ───
    section("2. The Core Loop")
    body("GundariuM's gameplay follows a seven-step loop that begins in the physical world and ends on-chain:")
    table([
        ["Step", "Action", "Description"],
        ["1", P("Photograph"), P("Player takes a photo of their real-world Gunpla model kit")],
        ["2", P("Identify"), P("Search a curated database of 148 Mobile Suits to find the matching kit")],
        ["3", P("Grade"), P("Select kit grade (SD, HG, RG, MG, MG Ver.Ka, Hi-Res, PG) \u2014 each grade maps to a rarity tier with stat multipliers")],
        ["4", P("Cosmetics"), P("Apply digital paint schemes and custom decals to the card photo via Cosmetics AI")],
        ["5", P("Mint"), P("Pay in USDC to mint an ERC-721 NFT card with on-chain traits")],
        ["6", P("Upgrade"), P("Enhance the card post-mint \u2014 upgrade weapons, boost stats, evolve the build")],
        ["7", P("Battle"), P("Enter PVE arcs or PVP matches, staking $GNDM tokens on the outcome")],
    ], [0.5*inch, 1.0*inch, 4.8*inch])
    body("The loop is designed so that each step adds value and meaning to the card. A photograph captures the builder's craft. Identification ties it to Gundam lore. Grading determines its power tier. Cosmetics let the builder express their vision digitally. Minting commits it to the blockchain. Upgrading rewards continued investment. And battle gives the card purpose.")

    # ─── 3. DESIGN PHILOSOPHY ───
    section("3. Design Philosophy")
    sub("Open Doors, Natural Incentives")
    body("During the conception of GundariuM, a fundamental question emerged: what happens when someone uploads a photo that isn't a Gunpla?")
    body("The answer could have been verification gates, AI-enforced rejection, or manual review queues. All of these create friction, false negatives, and a hostile first experience. Instead, GundariuM takes a different approach: <b>the system is open to everyone, but rewards authenticity through features, not restrictions.</b>")
    body("Any user can mint a card with any photo and play the game. We don't gatekeep entry. But users who photograph real Gunpla kits unlock the full experience:")
    bullet("<b>Cosmetics AI</b> works by recognizing Gunpla geometry to apply digital paint and decals. A non-Gunpla photo will produce poor or unusable results \u2014 the feature naturally self-selects for authentic kits.")
    bullet("<b>Lore connection</b> \u2014 selecting a real Mobile Suit means your card carries the story, faction, pilot, and weapons of that suit. The emotional resonance only works if it's real.")
    bullet("<b>Community recognition</b> \u2014 in a game where your physical collection is your reputation, players who mint real Gunpla earn organic respect. You can't fake a shelf.")
    body("The game self-selects for its target audience by making the best features work best with real Gunpla. No walls, just incentives.")

    sub("Grade as Truth")
    body("GundariuM ties kit grade directly to in-game power. This isn't arbitrary \u2014 it reflects real-world value. A Perfect Grade kit costs $200\u2013400+, takes 40+ hours to build, and represents the pinnacle of the hobby. An SD kit costs $5\u201315 and takes an hour. The game respects this reality with grade multipliers from 0.7x (SD/Common) to 1.5x (PG/Legendary). No artificial scarcity mechanics needed \u2014 the scarcity is real.")

    # ─── 4. CARD SYSTEM ───
    section("4. Card System")
    sub("The Suit Database")
    body("GundariuM's card system is built on a curated database of <b>148 Mobile Suits</b> covering the full breadth of the Gundam franchise. Each entry contains identity (name, model number, series, timeline), lore (faction, pilot), combat data (weapons, armor type, stat ranges), and kit data (available grades, rarity, known print run).")

    sub("Grade Multipliers")
    table([
        ["Grade", "Rarity", "Multiplier"],
        [P("SD"), P("Common"), P("0.70x")],
        [P("HG"), P("Common"), P("0.85x")],
        [P("RG"), P("Uncommon"), P("1.00x")],
        [P("MG"), P("Rare"), P("1.15x")],
        [P("MG Ver.Ka / Hi-Res"), P("Ultra Rare"), P("1.30x")],
        [P("PG"), P("Legendary"), P("1.50x")],
    ], [2*inch, 1.5*inch, 1.5*inch])

    sub("Weapons")
    table([
        ["Slot", "Source", "Role"],
        [P("Primary"), P("weapons[0]"), P("Main weapon, used most frequently in rotation")],
        [P("Secondary"), P("weapons[1]"), P("Backup weapon")],
        [P("Tertiary"), P("weapons[2]"), P("Situational weapon")],
        [P("Special"), P("weapons[4] or [3]"), P("High-impact ability, used least frequently")],
    ], [1*inch, 1.5*inch, 3.8*inch])

    sub("Armor Types")
    table([
        ["Armor Type", "Effect", "Lore Origin"],
        [P("Standard"), P("No special resistance"), P("Basic mobile suit armor")],
        [P("Luna Titanium"), P("Reduces melee (0.60x)"), P("RX-78 line, original Gundam")],
        [P("Gundanium Alloy"), P("Reduces all damage (0.80x)"), P("After Colony (Wing)")],
        [P("Phase Shift"), P("Blocks physical melee (0.15x)"), P("Cosmic Era (SEED)")],
        [P("I-Field"), P("Blocks beam weapons (0.45x)"), P("UC beam barrier")],
        [P("GN Particles"), P("Reduces ranged (0.65x)"), P("Anno Domini (00 Gundam)")],
    ], [1.3*inch, 2.2*inch, 2.8*inch])

    sub("Cosmetics AI")
    body("The Cosmetics AI lets players apply <b>digital paint schemes</b> and <b>custom decals</b> to their card photos. The AI recognizes Gunpla geometry \u2014 panel lines, armor segments, joint structures \u2014 to apply cosmetics accurately. This is the natural quality gate: non-Gunpla photos produce poor results because the AI can't identify the surfaces it needs to modify.")

    sub("Upgrades")
    body("After minting, cards are not static. The upgrade system allows weapon upgrades, stat boosts, and build evolution over time \u2014 rewarding loyalty and active play.")

    # ─── 5. BATTLE SYSTEM ───
    section("5. Battle System")
    sub("Overview")
    body("GundariuM's battle system is <b>Pokemon-style turn-based combat</b> \u2014 not auto-battle. Each turn, players choose their action: which weapon to fire, what stance to take, how to respond. Wins are determined by player decisions, not just card stats.")

    sub("Turn Structure")
    bullet("<b>Speed check</b> \u2014 the faster suit acts first")
    bullet("<b>Action selection</b> \u2014 each player chooses a weapon and optional stance")
    bullet("<b>Damage calculation</b> \u2014 base damage \u00d7 grade multiplier \u00d7 armor effectiveness")
    bullet("<b>Resolution</b> \u2014 HP reduced, status effects applied")
    bullet("<b>Turn timer</b> \u2014 chess-clock enforcement; timeout forfeits the action")
    body("Battles run for a maximum of <b>40 turns</b>. Tiebreak goes to the highest remaining HP percentage.")

    sub("Weapon Selection")
    body("Each turn, players choose from all four of their card's weapons \u2014 just like choosing a move in Pokemon. There is no forced rotation or cooldown. Every weapon is available every turn.")
    body("The strategic depth comes from reading your opponent: lead with your Special for massive damage, or save it for when they drop their guard? Pick your beam weapon because their armor is weak to it, or walk into an I-Field (0.45x)? Go physical melee against what might be Phase Shift (0.15x), or play it safe with ranged? Every turn is a decision. No autopilot.")

    sub("Armor Effectiveness")
    body("Armor matchups are the tactical heart of combat. I-Field vs. Beam: 0.45x | Phase Shift vs. Physical melee: 0.15x | GN Particles vs. Ranged: 0.65x | Luna Titanium vs. Melee: 0.60x | Gundanium vs. All: 0.80x. A Common card with I-Field can survive against a Legendary beam attacker if the player reads the matchup. Knowledge beats rarity.")

    sub("Battle Modes")
    body("<b>PVE:</b> Story-driven campaign arcs based on Gundam plotlines. Entry fee returned on completion plus arc rewards. <b>PVP:</b> Real-time WebSocket matches with $GNDM staking, 10% protocol fee, ranked matchmaking with seasonal leaderboards.")

    # ─── 6. TOKENOMICS ───
    section("6. $GNDM Tokenomics")
    sub("Token Utility")
    table([
        ["Use Case", "Mechanism"],
        [P("Battle staking"), P("Stake $GNDM on PVP matches; winner takes pot minus protocol fee")],
        [P("PVE entry"), P("$GNDM fee to enter campaign arcs; returned on completion")],
        [P("Staking rewards"), P("Synthetix-style continuous yield distribution")],
        [P("Tournament prizes"), P("Prize pools for seasonal and weekly tournaments")],
        [P("Upgrade currency"), P("Spend $GNDM to upgrade card stats and weapons")],
        [P("Governance (future)"), P("Token-weighted voting on game balance and new suits")],
    ], [1.8*inch, 4.5*inch])

    sub("Staking Mechanics")
    bullet("<b>24-hour lock</b> after staking (re-staking resets the timer)")
    bullet("<b>7-day reward eligibility window</b> \u2014 maintain position for a full week to earn rewards")
    bullet("Rewards distributed continuously, claimable after eligibility window")
    bullet("Staking contract is <b>live on Base mainnet</b> with active participants")

    sub("Revenue Flows")
    table([
        ["Source", "Rate", "Destination"],
        [P("PVP battle stakes"), P("10% protocol fee"), P("Treasury / reward pool")],
        [P("Card minting"), P("USDC mint fee"), P("Treasury")],
        [P("Cosmetic upgrades"), P("USDC fee"), P("Treasury")],
        [P("Tournament entry"), P("$GNDM entry fee"), P("Prize pool + protocol")],
    ], [1.5*inch, 1.5*inch, 3.3*inch])

    # ─── 7. SMART CONTRACTS ───
    section("7. Smart Contracts")
    body("All contracts are Solidity ^0.8.20, built with Foundry, using <b>UUPS upgradeable proxy pattern</b> (OpenZeppelin v5).")

    sub("Contract Overview")
    table([
        ["Contract", "Purpose", "Status"],
        [P("GunplaCard"), P("ERC-721 with full CardTraits struct on-chain. USDC mint pricing. Cosmetic upgrades supported."), P("Deployed Base Sepolia")],
        [P("GundaniumGame"), P("Hybrid on-chain/off-chain battle. EIP-712 signed BattleResult settlement. PVP/PVE."), P("Deployed Base Sepolia")],
        [P("GNDMStaking"), P("Synthetix-style yield. 24hr lock, 7-day reward window."), P("<b>LIVE Base Mainnet</b>")],
        [P("$GNDM Token"), P("ERC-20 game utility token for staking, battles, upgrades."), P("<b>LIVE Base Mainnet</b>")],
    ], [1.2*inch, 3.5*inch, 1.5*inch])
    body("All contracts are chain-agnostic. Deploying to new chains requires only RPC endpoint and gas token configuration \u2014 no architectural changes.")

    # ─── 8. TECHNOLOGY ───
    section("8. Technology &amp; Infrastructure")
    sub("Web Application")
    body("GundariuM is a full web application at <b>gundarium.xyz</b>, not a dApp with a wallet modal bolted on.")
    table([
        ["Layer", "Technology"],
        [P("Framework"), P("Next.js 16 (App Router), React 19")],
        [P("Styling"), P("TailwindCSS v4, CSS custom properties")],
        [P("Typography"), P("Orbitron (headings), Geist Sans + Mono")],
        [P("State"), P("Zustand (client stores)")],
        [P("Web3"), P("wagmi v3, viem v2")],
        [P("AI"), P("Anthropic Claude SDK")],
        [P("Contracts"), P("Solidity ^0.8.20, Foundry, OpenZeppelin v5")],
        [P("Deployment"), P("Vercel")],
    ], [1.5*inch, 4.8*inch])

    sub("Wallet Integration")
    bullet("<b>Farcaster embedded wallet</b> \u2014 auto-connects inside Farcaster miniapp")
    bullet("<b>Ronin Waypoint</b> \u2014 seedless wallet via email/social, gas-sponsored")
    bullet("<b>WalletConnect</b> \u2014 QR modal supporting 300+ wallets")
    bullet("<b>Injected wallets</b> \u2014 MetaMask, Coinbase Wallet, browser extensions")

    sub("Backend Services")
    table([
        ["Service", "Provider", "Purpose"],
        [P("Frontend"), P("Vercel"), P("Next.js deployment, previews, CDN")],
        [P("Battle server"), P("Cloudflare Workers + DO"), P("Stateful real-time battle sessions")],
        [P("Game database"), P("Cloudflare D1"), P("Leaderboard, battle history, stats")],
        [P("NFT storage"), P("Cloudflare R2"), P("Card images + metadata, zero egress")],
        [P("Anti-abuse"), P("Cloudflare KV + Turnstile"), P("Rate limiting, bot prevention")],
    ], [1.2*inch, 2.2*inch, 2.9*inch])

    # ─── 9. MULTI-CHAIN ───
    section("9. Multi-Chain Strategy")
    sub("Base")
    body("Base is where GundariuM was born. The project entered crypto through Farcaster in November 2025:")
    bullet("<b>Farcaster miniapp</b> \u2014 discoverable in-feed by millions of users")
    bullet("<b>Base App MiniApp</b> \u2014 native mobile discovery")
    bullet("<b>$GNDM token</b> \u2014 live on Base mainnet with active staking")
    bullet("<b>Community roots</b> \u2014 mentored by NomadicFrame (TYSM, 10K+ community)")

    sub("Ronin")
    body("Ronin is where GundariuM's audience already lives \u2014 a chain built for gaming with an anime-adjacent community:")
    bullet("<b>Gaming-native users</b> \u2014 Axie, Pixels, Craft World players")
    bullet("<b>Ronin Waypoint</b> \u2014 seedless onboarding for non-crypto Gunpla hobbyists")
    bullet("<b>Katana DEX</b> \u2014 $GNDM liquidity on Ronin")
    bullet("<b>Gas sponsorship</b> \u2014 gas-free transactions for new users")

    sub("Cross-Chain Philosophy")
    body("At launch, each chain operates its own independent card economy and battle ecosystem. Cross-chain card bridging and unified leaderboards are on the post-launch roadmap.")

    # ─── 10. ROADMAP ───
    section("10. Roadmap")
    sub("Completed")
    bullet("148-suit curated database with full Gundam lore metadata")
    bullet("GunplaCard, GundaniumGame, GNDMStaking deployed on Base Sepolia")
    bullet("$GNDM token and GNDMStaking <b>live on Base mainnet</b>")
    bullet("Complete mint flow, battle simulation engine, Farcaster miniapp")
    bullet("gundarium.xyz live and functional")

    sub("May 10, 2026 \u2014 Full Launch")
    bullet("Mint flow live on Base mainnet and Ronin mainnet")
    bullet("Arena: PVE campaign arcs and PVP real-time battles")
    bullet("Leaderboard, Prize Pools, $GNDM staking on both chains")
    bullet("Ronin Waypoint integration, $GNDM on Katana DEX")
    bullet("Base App MiniApp integration")

    sub("Q3 2026")
    bullet("PVP ranked matchmaking, weekly/seasonal tournaments")
    bullet("Cosmetics AI launch (digital paint + decals)")
    bullet("Card upgrade system")

    sub("Q4 2026")
    bullet("Cross-chain card bridging (Base \u2194 Ronin)")
    bullet("Unified leaderboard, new suits (community nominations)")
    bullet("Advanced battle mechanics (stances, team battles)")

    sub("2027")
    bullet("Mobile app (React Native) for photo capture and battle")
    bullet("Additional chain expansions, governance system")
    bullet("Partnership integrations with Gunpla retailers and events")

    # ─── 11. TEAM ───
    section("11. Team \u2014 PyroFire Labs")
    body("<b>Joshua Grubbs \u2014 Founder &amp; Lead Developer</b>")
    body("Full-stack developer handling smart contracts, frontend, and architecture. Entered crypto development in November 2025 through Farcaster. Shipped a working MVP with mainnet contracts, a complete mint flow, and a 148-suit database in under 5 months. Active Ronin gamer with staked RON.")
    story.append(Spacer(1, 6))
    body("<b>Larry \u2014 AI Development Partner (Claude Code)</b>")
    body("Larry is named after Joshua's late father \u2014 the greatest influence in his life. Larry Sr. was an early tech adopter who got the family's first PC in 1995 and was the first in the neighborhood with DSL high-speed internet when everyone else was on dial-up. He cornered online auto sales through his dealership, landing contracts with Cars.com and Vehix.com. He always wanted the latest gaming console the day it released \u2014 from the Sega Genesis to every generation after \u2014 because he believed technology would make the world a better place. He played Madden from its earliest days with Madden 93. His passion for tech and sales shaped Joshua's career, first into sales and now into web development. Naming the AI partner \"Larry\" keeps his dad in the work he would have loved to see.")
    story.append(Spacer(1, 4))
    body("Larry is a core collaborator on architecture, contracts, battle systems, and documentation. The entire codebase, smart contracts, and this whitepaper were developed through this partnership.")
    story.append(Spacer(1, 3))
    body("<b>Kayonfire (Farcaster) \u2014 Brand &amp; Visual Design</b> \u2014 Contracted for logo, promotional materials, and visual identity.")
    story.append(Spacer(1, 3))
    body("<b>NomadicFrame (Farcaster) \u2014 Advisor</b> \u2014 Creator of TYSM, 10,000+ staker community. Mentor on community building, token economics, and Farcaster strategy.")
    story.append(Spacer(1, 3))
    body("<b>Battle Animation Designer \u2014 Hiring</b> \u2014 Three prospects being evaluated for 2D/3D battle animation sequences.")

    # ─── DISCLAIMER ───
    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "This whitepaper is for informational purposes only and does not constitute financial advice, an offer of securities, "
        "or a solicitation of investment. $GNDM is a utility token intended for use within the GundariuM game ecosystem. "
        "Token value may fluctuate. Participation in GundariuM involves risk, including the potential loss of staked tokens.",
        styles['Disclaimer']
    ))
    story.append(Paragraph(
        "<b>GundariuM is an independent fan project.</b> PyroFire Labs holds no rights to the name, likeness, or intellectual "
        "property of Mobile Suit Gundam, Gunpla, or any related franchise properties. GundariuM is not affiliated with, endorsed "
        "by, or sponsored by Bandai Namco, Sunrise, Sotsu, or any rights holders of the Gundam franchise. All Mobile Suit names, "
        "model numbers, pilot names, faction names, series titles, and lore references are the property of their respective owners "
        "and are used here solely for identification and gameplay purposes within a fan-created experience. Player-uploaded "
        "photographs of Gunpla model kits remain the property of the players who created them.",
        styles['Disclaimer']
    ))
    story.append(Spacer(1, 16))
    story.append(Paragraph("<i>GundariuM \u2014 Your shelf is your deck.</i>", styles['Body']))
    story.append(Paragraph("<b>gundarium.xyz</b> | PyroFire Labs | 2026", styles['Body']))

    doc.build(story)
    print("PDF generated: GundariuMwhitepaper.pdf")


if __name__ == "__main__":
    build_pdf()
