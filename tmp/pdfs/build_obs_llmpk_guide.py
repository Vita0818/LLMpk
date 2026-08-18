from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = Path("output/pdf/llmpk_obs_edge_native_resolution_recording_guide_zh.pdf")
FONT = "STSong-Light"

pdfmetrics.registerFont(UnicodeCIDFont(FONT))

INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#64748B")
NAVY = colors.HexColor("#0F172A")
BLUE = colors.HexColor("#2563EB")
CYAN = colors.HexColor("#0EA5E9")
MINT = colors.HexColor("#047857")
PAPER = colors.HexColor("#F8FAFC")
BORDER = colors.HexColor("#D9E2EF")
LIGHT_BLUE = colors.HexColor("#EFF6FF")
LIGHT_MINT = colors.HexColor("#ECFDF5")
LIGHT_AMBER = colors.HexColor("#FFFBEB")
AMBER = colors.HexColor("#B45309")


def make_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "cover-title",
            parent=base["Title"],
            fontName=FONT,
            fontSize=27,
            leading=35,
            textColor=NAVY,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "cover-subtitle",
            parent=base["Normal"],
            fontName=FONT,
            fontSize=11,
            leading=17,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName=FONT,
            fontSize=18,
            leading=26,
            textColor=NAVY,
            spaceBefore=0,
            spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName=FONT,
            fontSize=12.5,
            leading=19,
            textColor=BLUE,
            spaceBefore=8,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=10.2,
            leading=16,
            textColor=INK,
            spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=8.8,
            leading=13.5,
            textColor=MUTED,
        ),
        "step": ParagraphStyle(
            "step",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=10.2,
            leading=16,
            textColor=INK,
            leftIndent=0,
            spaceAfter=7,
        ),
        "code": ParagraphStyle(
            "code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=8.6,
            leading=13,
            textColor=colors.HexColor("#0F3B7A"),
        ),
        "table": ParagraphStyle(
            "table",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=9.1,
            leading=13.5,
            textColor=INK,
        ),
        "table_header": ParagraphStyle(
            "table_header",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=9,
            leading=13,
            textColor=colors.white,
        ),
        "center": ParagraphStyle(
            "center",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=10,
            leading=15,
            textColor=INK,
            alignment=TA_CENTER,
        ),
    }


S = make_styles()


def p(text, style="body"):
    return Paragraph(text, S[style])


def menu(text):
    return Paragraph(escape(text), S["code"])


def card(items, background=PAPER, padding=12):
    # A single cell keeps the card together and applies padding only around
    # its contents, rather than adding padding to every individual line.
    table = Table([[items]], colWidths=[170 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), padding),
        ("RIGHTPADDING", (0, 0), (-1, -1), padding),
        ("TOPPADDING", (0, 0), (-1, -1), padding),
        ("BOTTOMPADDING", (0, 0), (-1, -1), padding),
    ]))
    return table


def step(number, title, text, path=None, background=colors.white):
    label = Table([[p(f"{number:02d}", "center")]], colWidths=[11 * mm], rowHeights=[11 * mm])
    label.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOX", (0, 0), (-1, -1), 0, colors.white),
    ]))
    content = [p(title, "h2"), p(text, "body")]
    if path:
        content.append(menu(path))
    body = Table([[content]], colWidths=[155 * mm])
    body.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    outer = Table([[label, body]], colWidths=[15 * mm, 155 * mm], hAlign="LEFT")
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([outer, Spacer(1, 6)])


def page_frame(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.45)
    canvas.line(20 * mm, 15 * mm, 190 * mm, 15 * mm)
    canvas.setFont(FONT, 8.3)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 9.5 * mm, "LLMpk - OBS 录屏教程 - English UI")
    canvas.drawRightString(190 * mm, 9.5 * mm, f"{doc.page}")
    canvas.restoreState()


def first_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#F1F5F9"))
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#DBEAFE"))
    canvas.circle(A4[0] - 12 * mm, A4[1] - 16 * mm, 30 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#D1FAE5"))
    canvas.circle(18 * mm, 24 * mm, 23 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 8.3)
    canvas.drawCentredString(A4[0] / 2, 13 * mm, "LLMpk - 录制前保持本地服务运行")
    canvas.restoreState()


story = []

# Page 1 - cover and quick route.
story.extend([
    Spacer(1, 47 * mm),
    p("LLMpk OBS 窗口录制教程", "title"),
    p("macOS - OBS Studio 英文界面 - Microsoft Edge - 原生窗口分辨率 - 60 FPS", "subtitle"),
    Spacer(1, 13 * mm),
    card([
        p("本教程只录制 Microsoft Edge 中正常显示的 LLMpk 榜单网页。不录制封面页，也不使用 Browser Source。录制前请确认本地服务仍在运行。", "body"),
        Spacer(1, 3),
        p("录制网页 URL", "small"),
        menu("http://localhost:5173/"),
        Spacer(1, 4),
        p("录制对象", "small"),
        menu("Microsoft Edge window"),
    ], background=colors.white, padding=14),
    Spacer(1, 12 * mm),
    p("推荐方式：直接捕获 Edge 窗口", "h1"),
    p("在 OBS 中使用 <font color='#2563EB'>macOS Screen Capture</font>，将 Method 设为 <font color='#2563EB'>Window Capture</font>，再选择 Microsoft Edge。这样录制的是浏览器窗口本身，操作网页时无需使用 Interact。", "body"),
    Spacer(1, 6),
    Table([
        [p("项目", "table_header"), p("推荐值", "table_header")],
        [p("Capture source", "table"), menu("macOS Screen Capture -> Window Capture")],
        [p("Canvas / Output", "table"), menu("same as Edge source native size")],
        [p("Frame rate", "table"), menu("60 FPS")],
        [p("Recording Format", "table"), menu("MKV")],
        [p("Encoder", "table"), menu("Apple VT H264 Hardware Encoder (if available)")],
    ], colWidths=[58 * mm, 112 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ])),
    PageBreak(),
])

# Page 2 - initial OBS settings.
story.extend([
    p("一、启动 OBS 与 60 FPS 初始设置", "h1"),
    step(1, "启动 OBS", "在 macOS 按 Command + Space，输入 OBS 后按 Return。第一次启动或第一次录屏时，macOS 可能要求屏幕录制权限。", "Command + Space  ->  OBS  ->  Return", LIGHT_BLUE),
    step(2, "授予 macOS 屏幕录制权限", "要直接录制 Edge 窗口，OBS 需要 macOS 屏幕录制权限。若预览中是黑屏或窗口列表为空，到系统设置授权 OBS；授权后完全退出并重新启动 OBS。", "System Settings  ->  Privacy & Security  ->  Screen & System Audio Recording  ->  OBS", LIGHT_AMBER),
    step(3, "先设置 60 FPS，不预先固定画布", "这一步只先设置帧率。不要把 Canvas 或 Output 填成 1920 × 1080，也不要填显示器的推测分辨率。等 Edge 窗口来源建立后，再读取 OBS 看到的实际来源像素尺寸，并让 Canvas 与 Output 精确匹配它。", "Settings  ->  Video\nCommon FPS Values: 60\nLeave Canvas / Output for the source-matching step", colors.white),
    step(4, "设置录像文件与硬件编码", "保持 Simple 模式即可。MKV 更稳妥，录制异常中断时文件通常仍可恢复；需要 MP4 时可在 OBS 结束后执行 remux。若 Encoder 菜单有 Apple VT H264 Hardware Encoder，优先选择它以减轻 CPU 负担。", "Settings  ->  Output\nOutput Mode: Simple\nRecording Format: MKV\nRecording Quality: High Quality or Indistinguishable Quality\nEncoder: Apple VT H264 Hardware Encoder", LIGHT_BLUE),
    card([
        p("可选：Advanced 输出模式", "h2"),
        p("如你需要明确控制码率，可把 <font color='#2563EB'>Output Mode</font> 改为 <font color='#2563EB'>Advanced</font>，在 <font color='#2563EB'>Recording</font> 标签中使用 H.264 硬件编码。原生分辨率可能高于 1080p，因此码率应从测试录制的清晰度与稳定性出发调整。", "body"),
    ], background=LIGHT_MINT),
    PageBreak(),
])

# Page 3 - one Edge window scene and source.
story.extend([
    p("二、建立一个 Edge 窗口录制场景", "h1"),
    p("只需要一个 Scene 和一个窗口捕获来源。先在 Edge 中打开正常榜单页，再把该窗口交给 OBS 捕获。", "body"),
    Spacer(1, 4),
    step(5, "准备 Microsoft Edge", "在 Edge 打开 http://localhost:5173/，停在你要录制的正常榜单页面。将窗口放大到你想要的画面尺寸；录制期间不要最小化该窗口。", "Microsoft Edge  ->  http://localhost:5173/", LIGHT_BLUE),
    step(6, "创建录制场景", "在 Scenes 面板点击 +，命名为 01 Edge。这个项目只需一个 Scene，不需要封面场景或第二个播放场景。", "Scenes  ->  +  ->  01 Edge", colors.white),
    step(7, "添加 Edge 窗口捕获", "在 Sources 面板点击 +，选择 macOS Screen Capture。把 Method 改为 Window Capture，再从 Window 列表中选择你的 Microsoft Edge 窗口。若需要录到鼠标操作，保留 Show cursor 为开启。", "Sources  ->  +  ->  macOS Screen Capture\nMethod: Window Capture\nWindow: Microsoft Edge\nShow cursor: On", LIGHT_MINT),
    PageBreak(),
])

# Page 4 - native resolution and top-black-bar troubleshooting.
story.extend([
    p("三、原生分辨率与全屏黑条", "h1"),
    p("先用右键 Transform 菜单检查来源位置。若来源的 Size 与 Canvas 相同、Position Y 也为 0，而顶部仍有黑条，则黑像素已经包含在捕获源中：先裁掉它，再计算最终原生高度。", "body"),
    card([
        p("右键入口与第一项检查", "h2"),
        p("你不需要使用 OBS 顶栏的 Edit。直接在 Sources 面板对 <font color='#2563EB'>macOS Screen Capture</font> 右键，打开 Transform 子菜单即可。若锁图标关闭，先暂时解锁来源。", "body"),
        menu("Right-click macOS Screen Capture  ->  Transform  ->  Reset Transform\nRight-click macOS Screen Capture  ->  Transform  ->  Edit Transform\nPosition X: 0   Position Y: 0   note Size (W x H)"),
        p("若 Size、Canvas、Output 均为 <font color='#B45309'>3644 × 2110</font>，且 Position Y 已为 0，那么顶部黑条不是画布留白，也不是单靠改位置能消除的问题；它就是这个捕获源顶部的一段黑像素。不要直接把 Canvas 的高度调小，否则会留下黑条并裁掉网页底部。", "body"),
        p("裁掉顶部黑像素，再设置最终高度", "h2"),
        menu("1. Select and unlock macOS Screen Capture\n2. In the preview, hold Option and drag the top edge down to the Edge top\n3. Right-click source  ->  Transform  ->  Edit Transform  ->  note Crop Top: T\n4. Settings  ->  Video\n   Canvas: 3644 x (2110 - T)\n   Output (Scaled): 3644 x (2110 - T)   FPS: 60"),
        p("Option 拖动是在裁剪，不是在缩放。若 Edit Transform 窗口直接提供 Crop 的 Top 数值，也可在那里输入。裁剪完成后保持 Position X / Y 为 0；<font color='#B45309'>不要再点击 Reset Transform</font>，因为它会清除裁剪。T 必须以 OBS 显示的 Crop Top 数值为准，不能从截图估算。", "body"),
        p("仅在裁剪后仍有黑条时", "h2"),
        p("如果裁剪后黑条仍然在 Edge 来源矩形内部，才退出 Edge 后检查 macOS 的应用级摄像头兼容选项：", "body"),
        menu("Finder  ->  Applications  ->  Microsoft Edge  ->  File  ->  Get Info\nuncheck (if checked): Scale to fit below built-in camera"),
        p("重新打开 Edge，在 OBS 中重新选择该 Window Capture，然后重新读取 Size。", "small"),
    ], background=LIGHT_AMBER),
    PageBreak(),
])

# Page 5 - recording and QA.
story.extend([
    p("四、录制正常网页与检查", "h1"),
    step(8, "确认原生尺寸录制画面", "选择 01 Edge。确认 OBS 预览是所选 Microsoft Edge 窗口，网页已停在正常 LLMpk 榜单页而不是封面页。来源应以 1:1 显示并铺满与其同尺寸的 Canvas；若再次只显示左上角，回到上一页重新核对 Edit Transform 中的 Size。", "Scene: 01 Edge", LIGHT_BLUE),
    step(9, "开始并结束录制", "先让 Edge 显示到准备开始的位置，再在 OBS 的 Controls 面板点击 Start Recording。录制时在 Edge 中正常操作网页；完成后回到 OBS 点击 Stop Recording。", "Controls  ->  Start Recording / Stop Recording", colors.white),
    step(10, "检查 60 FPS 是否稳定", "开始前先录制 10 秒测试片段。OBS 底部状态栏应持续显示约 60 FPS，且不应出现 encoding overload、skipped frames 或明显卡顿。若有问题，先关闭其他高负荷应用，再确认 Encoder 使用硬件编码。", "OBS status bar  ->  FPS / Skipped Frames / Encoding", LIGHT_MINT),
    p("录制前检查清单", "h2"),
])

checklist = [
    "本地服务仍在运行，Edge 可打开 http://localhost:5173/。",
    "Edge 停在要录制的正常榜单页，不是封面页。",
    "macOS Screen Capture 的 Method 为 Window Capture，且 Window 已选择 Microsoft Edge。",
    "Settings -> Video 的 Canvas 与 Output 已填入 Edit Transform 中相同的 Size，FPS 为 60。",
    "macOS Screen Capture 已使用 Reset Transform 保持 1:1，没有使用 Fit to screen 或 Stretch to screen。",
    "若 Size 为 3644 × 2110 且 Position Y 为 0，已裁掉 Crop Top: T，并将 Canvas / Output 设为 3644 × (2110 - T)。",
    "Recording Format 为 MKV，且磁盘有足够空间。",
    "先录 10 秒测试片段，确认无卡顿与漏帧。",
]
check_rows = [[p("□  " + item, "body")] for item in checklist]
check_table = Table(check_rows, colWidths=[170 * mm])
check_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), PAPER),
    ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story.append(check_table)


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=20 * mm,
    rightMargin=20 * mm,
    topMargin=18 * mm,
    bottomMargin=23 * mm,
    title="LLMpk OBS Edge 原生分辨率录制教程 - 中文",
    author="LLMpk",
)
doc.build(story, onFirstPage=first_page, onLaterPages=page_frame)
print(OUTPUT)
