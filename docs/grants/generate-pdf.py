#!/usr/bin/env python3
"""Generate the GundariuM Ronin Grant Proposal PDF."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Image
)
import os

# Colors
DARK_BG = HexColor("#1a1a2e")
GOLD = HexColor("#d4a017")
BLUE = HexColor("#4a9eff")
WHITE = HexColor("#ffffff")
LIGHT_GRAY = HexColor("#f5f5f5")
MED_GRAY = HexColor("#e0e0e0")
DARK_GRAY = HexColor("#333333")
TEXT_COLOR = HexColor("#2d2d2d")
HEADER_BG = HexColor("#1a1a2e")
TABLE_HEADER = HexColor("#2d2d5e")
TABLE_ALT = HexColor("#f0f0f8")

def build_pdf():
    doc = SimpleDocTemplate(
        "ronin-grant-proposal.pdf",
        pagesize=letter,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
        leftMargin=0.85*inch,
        rightMargin=0.85*inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        'DocTitle',
        parent=styles['Title'],
        fontSize=28,
        textColor=HEADER_BG,
        spaceAfter=6,
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=13,
        textColor=BLUE,
        spaceAfter=4,
        fontName='Helvetica',
    ))
    styles.add(ParagraphStyle(
        'SectionHead',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=HEADER_BG,
        spaceBefore=20,
        spaceAfter=10,
        fontName='Helvetica-Bold',
        borderWidth=0,
        borderPadding=0,
    ))
    styles.add(ParagraphStyle(
        'SubHead',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=BLUE,
        spaceBefore=14,
        spaceAfter=6,
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=10.5,
        textColor=TEXT_COLOR,
        spaceAfter=8,
        leading=15,
        alignment=TA_JUSTIFY,
        fontName='Helvetica',
    ))
    styles.add(ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontSize=10.5,
        textColor=TEXT_COLOR,
        spaceAfter=8,
        leading=15,
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'BulletCustom',
        parent=styles['Normal'],
        fontSize=10.5,
        textColor=TEXT_COLOR,
        spaceAfter=4,
        leading=15,
        leftIndent=20,
        bulletIndent=8,
        fontName='Helvetica',
    ))
    styles.add(ParagraphStyle(
        'Quote',
        parent=styles['Normal'],
        fontSize=11,
        textColor=DARK_GRAY,
        spaceAfter=10,
        spaceBefore=6,
        leading=16,
        leftIndent=24,
        rightIndent=24,
        fontName='Helvetica-Oblique',
        alignment=TA_JUSTIFY,
    ))
    styles.add(ParagraphStyle(
        'SmallGray',
        parent=styles['Normal'],
        fontSize=9,
        textColor=HexColor("#888888"),
        spaceAfter=4,
        fontName='Helvetica',
    ))

    story = []

    # ─── COVER / HEADER ───
    banner_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "banner.png")
    if os.path.exists(banner_path):
        banner = Image(banner_path, width=6.3*inch, height=6.3*inch * (820/1456))
        story.append(banner)
        story.append(Spacer(1, 12))
    else:
        story.append(Spacer(1, 40))
    story.append(Paragraph("GundariuM", styles['DocTitle']))
    story.append(Paragraph("Ronin Network Grant Proposal", styles['DocSubtitle']))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=2, color=GOLD))
    story.append(Spacer(1, 12))

    meta_data = [
        ["Applicant", "PyroFire Labs"],
        ["Founder", "Joshua Grubbs (PyroFireZero)"],
        ["Date", "March 20, 2026"],
        ["Grants Applied For", "Forge Innovation Grant, Ecosystem Builder Grant, Waypoint Gas Grant"],
        ["Launch Date", "May 10, 2026"],
    ]
    meta_table = Table(meta_data, colWidths=[1.8*inch, 4.5*inch])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), HEADER_BG),
        ('TEXTCOLOR', (1, 0), (1, -1), TEXT_COLOR),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 20))

    # ─── 1. EXECUTIVE SUMMARY ───
    story.append(Paragraph("1. Executive Summary", styles['SectionHead']))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "GundariuM is a physical-to-digital NFT card battle game where players photograph their real "
        "Gunpla model kits and mint them as playable ERC-721 battle cards with lore-accurate stats. "
        "Each card carries the identity of the Mobile Suit it represents \u2014 its pilot, faction, weapons, "
        "armor type, and series \u2014 all derived from a curated database of 148 suits spanning the entire "
        "Gundam universe.",
        styles['Body']
    ))
    story.append(Paragraph(
        "Players then use these cards in Pokemon-style turn-based battles with $GNDM token staking, "
        "strategic weapon selection, and armor-type matchups that reward knowledge of the source material.",
        styles['Body']
    ))

    story.append(Paragraph("Why Ronin?", styles['SubHead']))
    story.append(Paragraph(
        "I'm not pitching Ronin because I found a grant page. I'm a Ronin gamer. I play Craft World "
        "(Angry Dynomites Labs), I've spent time in Pixels, and I have staked RON. When I started building "
        "GundariuM, I was new to crypto development \u2014 I came in through Farcaster and Base in November 2025, "
        "mentored by NomadicFrame (creator of TYSM and the gratitude economy). I built my MVP on Base because "
        "that's where I learned to ship. But the game I'm building \u2014 anime-themed collectible card battles \u2014 "
        "belongs where the gaming community already lives. That's Ronin.",
        styles['Body']
    ))
    story.append(Paragraph(
        "GundariuM has a working MVP with smart contracts deployed on both Base Sepolia (testnet) and "
        "Base mainnet \u2014 the $GNDM token and GNDMStaking contracts are already live in production with active "
        "stakers. The complete mint flow, 148-suit database, client-side trait generation, and battle simulation "
        "engine are all functional. I'm not applying with an idea. I'm applying with a product that's already on mainnet.",
        styles['BodyBold']
    ))

    # ─── 2. PRODUCT OVERVIEW ───
    story.append(PageBreak())
    story.append(Paragraph("2. Product Overview", styles['SectionHead']))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("The Core Loop", styles['SubHead']))
    fc = ParagraphStyle('FlowCell', parent=styles['Normal'], fontSize=9.5, leading=13, fontName='Helvetica', textColor=TEXT_COLOR)
    flow_data = [["Step", "Action", "Description"]]
    flow_rows = [
        ["1", Paragraph("Photograph", fc), Paragraph("Player takes a photo of their real-world Gunpla model kit", fc)],
        ["2", Paragraph("Identify", fc), Paragraph("Search a curated database of 148 Mobile Suits to find their kit", fc)],
        ["3", Paragraph("Grade", fc), Paragraph("Select kit grade (SD, HG, RG, MG, MG Ver.Ka, Hi-Res, PG) \u2014 each grade is a rarity tier with stat multipliers", fc)],
        ["4", Paragraph("Cosmetics", fc), Paragraph("Apply digital paint schemes and custom decals via Cosmetics AI", fc)],
        ["5", Paragraph("Mint", fc), Paragraph("Pay in USDC to mint an ERC-721 NFT card with on-chain traits", fc)],
        ["6", Paragraph("Upgrade", fc), Paragraph("Enhance your card post-mint \u2014 upgrade weapons, boost stats, evolve your build", fc)],
        ["7", Paragraph("Battle", fc), Paragraph("Enter PVE arcs or PVP matches, staking $GNDM tokens on the outcome", fc)],
    ]
    flow_data.extend(flow_rows)
    flow_table = Table(flow_data, colWidths=[0.5*inch, 1.0*inch, 4.8*inch])
    flow_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, TABLE_ALT]),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
    ]))
    story.append(flow_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("What Makes GundariuM Unique", styles['SubHead']))
    unique_points = [
        ("<b>Physical-to-digital bridge:</b> Your real Gunpla collection becomes your in-game deck. "
         "Every card represents a model kit you own and photographed."),
        ("<b>Lore-accurate stats:</b> Weapons, armor types, and factions are pulled from canonical Gundam data. "
         "An RX-78-2 fights differently than a Wing Zero because they should."),
        ("<b>Grade = Rarity = Power:</b> A Perfect Grade kit (PG, Legendary) is genuinely harder to build and "
         "more expensive IRL \u2014 the game reflects that with a 1.5x stat multiplier. An SD kit (Common, 0.7x) "
         "is accessible but weaker."),
        ("<b>Armor-type matchups:</b> I-Field blocks beam (0.45x), Phase Shift nullifies physical melee (0.15x), "
         "GN Particles reduce ranged (0.65x), Luna Titanium resists melee (0.60x), Gundanium alloy reduces all (0.80x). "
         "Knowing your enemy's armor type matters."),
        ("<b>AI-vision pipeline:</b> A Claude AI analysis route exists in the codebase for automated Gunpla identification. "
         "Ready to activate for authenticity verification and future features."),
        ("<b>Cosmetics AI \u2014 where the real magic happens:</b> Players can digitally paint their cards and add "
         "custom decals overlaid onto their photograph. This is the killer feature for Gunpla enthusiasts \u2014 seeing "
         "your real kit with custom color schemes and markings applied digitally. It also serves as the system's natural "
         "quality gate: non-Gunpla photos won't work well with the AI overlay, since it needs to recognize Gunpla "
         "geometry to apply cosmetics accurately."),
    ]
    for p in unique_points:
        story.append(Paragraph(p, styles['BulletCustom'], bulletText="\u2022"))

    story.append(PageBreak())
    story.append(Paragraph("Design Philosophy: Open Doors, Natural Incentives", styles['SubHead']))
    story.append(Paragraph(
        "During conception, I realized there are variables I can't control \u2014 anyone can upload any photo, "
        "whether it's a Gundam or not. Rather than building expensive verification gates that create friction "
        "and false negatives, I made a deliberate design choice: <b>the system is open to everyone, but rewards "
        "authenticity through features, not restrictions.</b>",
        styles['Body']
    ))
    story.append(Paragraph(
        "Any user can mint a card with any photo and play the game. We don't gatekeep. But users who photograph "
        "real Gunpla kits unlock the full experience \u2014 the Cosmetics AI, the connection between your physical "
        "shelf and your digital deck, the pride of seeing your actual build as a battle card. The game self-selects "
        "for its target audience by making the best features work best with real Gunpla. No walls, just incentives.",
        styles['Body']
    ))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Target Audience", styles['SubHead']))
    audiences = [
        "<b>Gunpla builders</b> \u2014 massive global community (Bandai sells 600M+ kits worldwide)",
        "<b>Gundam anime fans</b> \u2014 the franchise spans 45+ years across every timeline",
        "<b>Ronin gamers</b> \u2014 already playing anime-adjacent titles (Axie, Pixels, Craft World)",
        "<b>NFT collectors</b> \u2014 utility-backed NFTs with real gameplay, not just art",
        "<b>Memecoin collectors</b> \u2014 $GNDM is a token with an actual game economy behind it",
        "<b>TCG players</b> \u2014 who want strategic depth beyond auto-battle",
    ]
    for a in audiences:
        story.append(Paragraph(a, styles['BulletCustom'], bulletText="\u2022"))

    # ─── 3. TECHNICAL ARCHITECTURE ───
    story.append(PageBreak())
    story.append(Paragraph("3. Technical Architecture", styles['SectionHead']))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Smart Contracts (Solidity ^0.8.20, Foundry, OpenZeppelin v5)", styles['SubHead']))
    story.append(Paragraph(
        "All contracts use the UUPS upgradeable proxy pattern for safe iteration post-launch.",
        styles['Body']
    ))

    cs = ParagraphStyle('ContractCell', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica', textColor=TEXT_COLOR)
    csb = ParagraphStyle('ContractCellBold', parent=cs, fontName='Helvetica-Bold')
    contract_data = [
        ["Contract", "Purpose", "Status"],
        [Paragraph("GunplaCard", cs), Paragraph("ERC-721 NFT with full on-chain traits (name, faction, pilot, weapons, armor, HP). USDC mint pricing.", cs), Paragraph("Deployed<br/>Base Sepolia", cs)],
        [Paragraph("GundaniumGame", cs), Paragraph("Hybrid battle model. On-chain staking + EIP-712 signed off-chain resolution. PVP/PVE.", cs), Paragraph("Deployed<br/>Base Sepolia", cs)],
        [Paragraph("GNDMStaking", cs), Paragraph("Synthetix-style yield accounting. 24hr lock, 7-day reward window.", cs), Paragraph("<b>LIVE on<br/>Base Mainnet</b>", cs)],
        [Paragraph("$GNDM Token", cs), Paragraph("ERC-20 game token for staking and battle rewards.", cs), Paragraph("<b>LIVE on<br/>Base Mainnet</b>", cs)],
    ]
    ct = Table(contract_data, colWidths=[1.2*inch, 3.5*inch, 1.5*inch])
    ct.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, TABLE_ALT]),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(ct)
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "<b>Ronin deployment:</b> These contracts are chain-agnostic (standard OpenZeppelin + EIP-712). "
        "Deploying to Ronin requires updating RPC endpoints and configuring for RON gas. No architectural changes needed.",
        styles['Body']
    ))

    story.append(Paragraph("Frontend Stack", styles['SubHead']))
    fe_points = [
        "Next.js 16 (App Router), React 19, TailwindCSS v4",
        "6-step Zustand state machine mint flow",
        "148-suit curated database with full metadata",
        "Client-side trait generation with grade multipliers",
        "wagmi v3 + viem v2 wallet integration",
        "Farcaster miniapp connector for social distribution",
    ]
    for p in fe_points:
        story.append(Paragraph(p, styles['BulletCustom'], bulletText="\u2022"))

    story.append(Paragraph("Battle System (In Development)", styles['SubHead']))
    battle_points = [
        "Pokemon-style turn-based combat with per-turn action selection",
        "Real-time WebSocket multiplayer via Cloudflare Durable Objects",
        "Chess-clock turn timer enforcement",
        "4-weapon rotation with armor-type effectiveness calculations",
        "Client-side battle simulation engine already built and functional",
    ]
    for p in battle_points:
        story.append(Paragraph(p, styles['BulletCustom'], bulletText="\u2022"))

    story.append(Paragraph("Infrastructure", styles['SubHead']))
    ic = ParagraphStyle('InfraCell', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica', textColor=TEXT_COLOR)
    infra_data = [
        ["Service", "Provider", "Purpose"],
        [Paragraph("Frontend hosting", ic), Paragraph("Vercel", ic), Paragraph("Next.js deployment, previews, CDN", ic)],
        [Paragraph("Battle server", ic), Paragraph("Cloudflare Workers + DO", ic), Paragraph("Stateful real-time game sessions", ic)],
        [Paragraph("Game database", ic), Paragraph("Cloudflare D1", ic), Paragraph("Leaderboard, battle history", ic)],
        [Paragraph("NFT storage", ic), Paragraph("Cloudflare R2", ic), Paragraph("Card images + metadata, zero egress", ic)],
        [Paragraph("Anti-abuse", ic), Paragraph("Cloudflare KV + Turnstile", ic), Paragraph("Rate limiting, bot prevention", ic)],
    ]
    it = Table(infra_data, colWidths=[1.3*inch, 2.2*inch, 2.8*inch])
    it.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, TABLE_ALT]),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(it)

    # ─── 4. TEAM ───
    story.append(PageBreak())
    story.append(Paragraph("4. Team \u2014 PyroFire Labs", styles['SectionHead']))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Joshua Grubbs \u2014 Founder &amp; Lead Developer</b>", styles['Body']))
    story.append(Paragraph(
        "Full-stack developer handling smart contracts (Solidity/Foundry), frontend (Next.js/React), "
        "and architecture. Started crypto development in November 2025 through the Farcaster community. "
        "Shipped a working MVP with deployed contracts, a complete mint flow, and a 148-suit curated database "
        "in under 5 months.",
        styles['Body']
    ))

    story.append(Paragraph("<b>Larry \u2014 AI Development Partner (Claude Code)</b>", styles['Body']))
    story.append(Paragraph(
        "GundariuM is built in collaboration with \"Larry,\" an AI development partner powered by Claude Code. "
        "Larry is named after Joshua's father \u2014 an avid gamer who played the Madden series from its earliest "
        "days on the Sega Genesis with Madden 93. Larry isn't just a code generator; he's a core collaborator "
        "on architecture decisions, contract design, battle system planning, and this proposal. This is how a "
        "solo founder ships at studio velocity \u2014 the entire codebase, smart contracts, battle simulation engine, "
        "and grant proposal were developed through this partnership.",
        styles['Body']
    ))

    story.append(Paragraph("<b>Kayonfire (Farcaster) \u2014 Brand &amp; Visual Design</b>", styles['Body']))
    story.append(Paragraph(
        "Contracted for GundariuM logo, promotional materials, and visual identity. Currently in production.",
        styles['Body']
    ))

    story.append(Paragraph("<b>NomadicFrame (Farcaster) \u2014 Advisor</b>", styles['Body']))
    story.append(Paragraph(
        "Creator of TYSM and the gratitude economy, with a 10K+ community of stakers. Mentor to Joshua since "
        "his entry into crypto development. Provides guidance on community building, token economics, and "
        "Farcaster ecosystem strategy.",
        styles['Body']
    ))

    story.append(Paragraph("<b>Battle Animation Designer \u2014 Hiring</b>", styles['Body']))
    story.append(Paragraph(
        "Three prospects currently being evaluated for 2D/3D battle animation sequences. "
        "Grant funding would accelerate this hire.",
        styles['Body']
    ))

    # ─── 5. RONIN ECOSYSTEM FIT ───
    story.append(Spacer(1, 10))
    story.append(Paragraph("5. Ronin Ecosystem Fit", styles['SectionHead']))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Why GundariuM Belongs on Ronin", styles['SubHead']))
    story.append(Paragraph(
        "<b>The community is already here.</b> Ronin is the home of anime-adjacent gaming. Axie Infinity proved "
        "that creature-battling NFT games can build massive communities on this chain. GundariuM is the Gundam "
        "version of that thesis \u2014 but with real-world physical collectibles as the entry point.",
        styles['Body']
    ))
    story.append(Paragraph(
        "<b>Complementary, not competitive.</b> No existing Ronin game bridges physical collectibles to on-chain "
        "gameplay. GundariuM adds a new category: phygital gaming. Every Gunpla builder who mints a card becomes "
        "a new Ronin user.",
        styles['Body']
    ))

    story.append(Paragraph(
        "Eligible categories: Web3 games (primary), AI-driven applications (AI vision pipeline), "
        "Bridge physical and digital commerce (Gunpla photos to NFT cards).",
        styles['BodyBold']
    ))

    story.append(Paragraph("Multi-Chain Strategy", styles['SubHead']))
    story.append(Paragraph(
        "GundariuM launches on both <b>Base</b> (existing community via Farcaster) and <b>Ronin</b> "
        "(gaming-native community). This isn't chain tourism \u2014 it's meeting players where they are.",
        styles['Body']
    ))
    mc_points = [
        "<b>Base:</b> Farcaster miniapp integration, Base App MiniApp integration, existing $GNDM token and staking contracts, social discovery",
        "<b>Ronin:</b> Gaming-first users, Katana DEX for $GNDM liquidity, Waypoint for frictionless onboarding, co-marketing with existing Ronin gaming community",
    ]
    for p in mc_points:
        story.append(Paragraph(p, styles['BulletCustom'], bulletText="\u2022"))

    story.append(Paragraph("User Onboarding via Ronin Waypoint", styles['SubHead']))
    story.append(Paragraph(
        "Ronin Waypoint integration removes the biggest barrier to adoption: wallet setup. New players can "
        "sign up with email/social (no seed phrase), get gas-sponsored transactions, mint their first card "
        "without ever touching a wallet UI, and gradually discover their on-chain identity as they play. "
        "This is critical for the Gunpla community, who are hobbyists first and crypto-native second.",
        styles['Body']
    ))

    # ─── 6. DEPLOYMENT TIMELINE ───
    story.append(PageBreak())
    story.append(Paragraph("6. Deployment Timeline", styles['SectionHead']))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
    story.append(Spacer(1, 8))
    story.append(Paragraph("<b>Launch date: May 10, 2026 \u2014 Full launch, not a beta.</b>", styles['Body']))
    story.append(Paragraph(
        "Everything goes live simultaneously: Mint flow, Arena (PVE/PVP battles), Leaderboard, Prize Pools, "
        "and $GNDM staking. The site is already live at <b>gundarium.xyz</b> and registered as a Farcaster miniapp. "
        "The GundariuM whitepaper will be published prior to launch.",
        styles['Body']
    ))

    phases = [
        ("Phase 1: Ronin Deployment", "Weeks 1\u20133 (Mar 20 \u2013 Apr 10)", [
            "Deploy all contracts to Ronin testnet (Saigon)",
            "Configure wagmi for Ronin chain (RPC, chain ID 2020)",
            "Test full mint flow on Ronin testnet",
            "Integrate Ronin Waypoint SDK as primary login",
            "Set up $GNDM on Katana DEX (testnet)",
        ]),
        ("Phase 2: Brand & Polish", "Weeks 3\u20135 (Apr 10 \u2013 Apr 24)", [
            "Receive logo and promo materials from Kayonfire",
            "Landing page refresh with Ronin branding",
            "Battle UI wireframes and animation integration",
            "Community building in Ronin Discord",
            "Security review of contracts (pre-audit checklist)",
        ]),
        ("Phase 3: Mainnet & Launch", "Weeks 5\u20137 (Apr 24 \u2013 May 10)", [
            "Deploy contracts to Ronin mainnet",
            "Smart contract audit (funded by grant)",
            "Provide initial $GNDM liquidity on Katana DEX",
            "Activate Waypoint gas sponsorship",
            "Launch day: May 10 \u2014 Mint, Arena, Leaderboard, Prize Pools all live",
            "Simultaneous launch on Base mainnet + Ronin mainnet",
        ]),
        ("Phase 4: Post-Launch Growth", "Weeks 8\u201316 (May \u2013 July)", [
            "PVP battle system beta (WebSocket battles)",
            "Tournament system with $GNDM prize pools",
            "Leaderboard with seasonal rankings",
            "Community tournaments co-marketed with Ronin ecosystem",
            "Activate AI vision pipeline for authenticity features",
        ]),
    ]

    for title, dates, items in phases:
        story.append(Paragraph(f"<b>{title}</b> \u2014 {dates}", styles['Body']))
        for item in items:
            story.append(Paragraph(item, styles['BulletCustom'], bulletText="\u2022"))
        story.append(Spacer(1, 4))

    # ─── 7. BUDGET BREAKDOWN ───
    story.append(Spacer(1, 10))
    story.append(Paragraph("7. Budget Breakdown", styles['SectionHead']))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
    story.append(Spacer(1, 8))

    # Forge
    story.append(Paragraph("Forge Innovation Grant Request: $50,000 in RON", styles['SubHead']))
    bc = ParagraphStyle('BudgetCell', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica', textColor=TEXT_COLOR)
    forge_data = [
        ["Item", "Amount", "Purpose"],
        [Paragraph("Smart contract security audit", bc), "$8,000", Paragraph("Professional audit of 4 contracts before mainnet", bc)],
        [Paragraph("$GNDM liquidity (Katana DEX)", bc), "$15,000", Paragraph("Initial liquidity pool for trading on Ronin", bc)],
        [Paragraph("Battle animation designer", bc), "$12,000", Paragraph("2D/3D battle move sequences (3-month contract)", bc)],
        [Paragraph("Brand &amp; visual design", bc), "$3,000", Paragraph("Logo, promo materials, landing page assets", bc)],
        [Paragraph("Infrastructure (6 months)", bc), "$5,000", Paragraph("Cloudflare Workers, R2 storage, D1 database", bc)],
        [Paragraph("Ronin Waypoint integration", bc), "$4,000", Paragraph("Development time for SDK integration + testing", bc)],
        [Paragraph("Community launch campaign", bc), "$3,000", Paragraph("Tournament prizes, early adopter rewards, content", bc)],
        [Paragraph("<b>Total</b>", bc), "<b>$50,000</b>", ""],
    ]
    ft = Table(forge_data, colWidths=[2.2*inch, 1*inch, 3.1*inch])
    ft.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, TABLE_ALT]),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, -1), (-1, -1), HexColor("#e8e8f0")),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ]))
    story.append(ft)
    story.append(Spacer(1, 12))

    # Builder
    story.append(Paragraph("Ecosystem Builder Grant Request: $150,000 in RON", styles['SubHead']))
    story.append(Paragraph("Milestone-based funding for sustained development:", styles['Body']))
    builder_data = [
        ["Milestone", "Amount", "Deliverable", "Timeline"],
        [Paragraph("M1: Ronin Launch", bc), "$30,000", Paragraph("Contracts deployed, mint flow live, Waypoint integrated", bc), "May 2026"],
        [Paragraph("M2: PVP Battles", bc), "$40,000", Paragraph("Real-time WebSocket battles, matchmaking, ranked play", bc), "Jul 2026"],
        [Paragraph("M3: Tournaments", bc), "$30,000", Paragraph("Seasonal tournaments, leaderboard, prize distribution", bc), "Sep 2026"],
        [Paragraph("M4: Cross-Chain", bc), "$25,000", Paragraph("Base-Ronin card bridging, unified leaderboard", bc), "Nov 2026"],
        [Paragraph("M5: Mobile App", bc), "$25,000", Paragraph("React Native app for photo capture + battle", bc), "Jan 2027"],
        [Paragraph("<b>Total</b>", bc), "<b>$150,000</b>", "", ""],
    ]
    bt = Table(builder_data, colWidths=[1.3*inch, 0.8*inch, 2.8*inch, 1.0*inch])
    bt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, TABLE_ALT]),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, -1), (-1, -1), HexColor("#e8e8f0")),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ]))
    story.append(bt)
    story.append(Spacer(1, 12))

    # Waypoint
    story.append(Paragraph("Waypoint Gas Grant Request: $20,000 in RON", styles['SubHead']))
    wp_points = [
        "Full Ronin Waypoint integration as primary login method",
        "Gas sponsorship for: card minting, battle session creation, staking transactions",
        "Goal: First 10,000 transactions gas-free for new users",
        "Estimated coverage: ~6 months of gas sponsorship at projected usage",
    ]
    for p in wp_points:
        story.append(Paragraph(p, styles['BulletCustom'], bulletText="\u2022"))

    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "<b>Combined ask across all three programs: $220,000</b>",
        styles['Body']
    ))

    # ─── 8. GROWTH STRATEGY ───
    story.append(PageBreak())
    story.append(Paragraph("8. Growth Strategy", styles['SectionHead']))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Community Channels", styles['SubHead']))
    cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica', textColor=TEXT_COLOR)
    growth_data = [
        ["Channel", "Strategy", "Target"],
        [Paragraph("Ronin Discord", cell_style), Paragraph("Partner with Axie, Pixels, Craft World communities", cell_style), Paragraph("Gaming-native users", cell_style)],
        [Paragraph("Farcaster", cell_style), Paragraph("Miniapp distribution, TYSM community (10K+)", cell_style), Paragraph("Crypto-native builders", cell_style)],
        [Paragraph("Gunpla communities", cell_style), Paragraph("Reddit r/Gunpla (300K+), Instagram, YouTube", cell_style), Paragraph("Hobbyists new to crypto", cell_style)],
        [Paragraph("Tournaments", cell_style), Paragraph("Weekly PVP with $GNDM prizes, seasonal ranks", cell_style), Paragraph("Competitive players", cell_style)],
    ]
    gt = Table(growth_data, colWidths=[1.3*inch, 2.7*inch, 2.0*inch])
    gt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, TABLE_ALT]),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(gt)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Onboarding Funnel", styles['SubHead']))
    story.append(Paragraph(
        "Gunpla builder sees GundariuM \u2192 Signs up via Waypoint (email) \u2192 Photographs kit \u2192 "
        "Mints first card (gas-free) \u2192 Plays PVE arc \u2192 Discovers $GNDM \u2192 Stakes \u2192 Enters PVP",
        styles['Quote']
    ))
    story.append(Paragraph(
        "The key insight: <b>every Gunpla builder already has the \"NFT\" on their shelf.</b> We're not asking "
        "them to buy a random JPEG \u2014 we're asking them to bring their existing collection on-chain. "
        "The barrier to entry is photographing something they're already proud of.",
        styles['Body']
    ))

    story.append(Paragraph("Growth Metrics (6-month targets)", styles['SubHead']))
    metric_data = [
        ["Metric", "Target"],
        ["Cards minted", "5,000"],
        ["Unique players", "2,000"],
        ["Battle sessions", "10,000"],
        ["$GNDM holders", "1,500"],
        ["Ronin new users onboarded", "1,000"],
    ]
    mt = Table(metric_data, colWidths=[2.5*inch, 1.5*inch])
    mt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, TABLE_ALT]),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
    ]))
    story.append(mt)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Revenue Model", styles['SubHead']))
    rev_data = [
        ["Source", "Mechanism"],
        ["Card minting", "USDC mint fee per card"],
        ["PVP battles", "10% protocol fee on $GNDM stakes"],
        ["Cosmetic upgrades", "USDC-gated repaints, decals, card borders"],
        ["Tournament entry", "Entry fees with prize pool distribution"],
    ]
    rt = Table(rev_data, colWidths=[1.8*inch, 4.5*inch])
    rt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, TABLE_ALT]),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(rt)

    # ─── 9. CLOSING ───
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=2, color=GOLD))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "GundariuM brings something new to Ronin: a game where your real-world collection is your deck. "
        "Every Gunpla kit photographed and minted is a new user onboarded, a new card in the economy, "
        "and a new reason for the massive global Gunpla community to discover blockchain gaming.",
        styles['Body']
    ))
    story.append(Paragraph(
        "I'm not a studio with a pitch deck and no product. I'm a solo founder with contracts live on "
        "Base mainnet, active stakers, a working MVP, and a launch date 51 days away. I play on Ronin already. I want to build here.",
        styles['Body']
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<b>PyroFire Labs is ready to deploy. We're asking Ronin to bet on us.</b>",
        styles['Body']
    ))

    # ─── DISCLAIMER ───
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY))
    story.append(Spacer(1, 6))
    disclaimer_style = ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=8, textColor=HexColor("#999999"), leading=11, fontName='Helvetica', alignment=TA_JUSTIFY)
    story.append(Paragraph(
        "<b>GundariuM is an independent fan project.</b> PyroFire Labs holds no rights to the name, likeness, or intellectual "
        "property of Mobile Suit Gundam, Gunpla, or any related franchise properties. GundariuM is not affiliated with, endorsed "
        "by, or sponsored by Bandai Namco, Sunrise, Sotsu, or any rights holders of the Gundam franchise. All Mobile Suit names, "
        "model numbers, pilot names, faction names, series titles, and lore references are the property of their respective owners "
        "and are used solely for identification and gameplay purposes within a fan-created experience.",
        disclaimer_style
    ))

    # Build
    doc.build(story)
    print("PDF generated: ronin-grant-proposal.pdf")

if __name__ == "__main__":
    build_pdf()
