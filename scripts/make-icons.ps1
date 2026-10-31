Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "assets"
New-Item -ItemType Directory -Force -Path $assets | Out-Null

function New-RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-HushIcon([int]$size, [string]$out) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $pad = [single]($size * 0.04)
  $radius = [single]($size * 0.235)
  $path = New-RoundedPath $pad $pad ($size - $pad * 2) ($size - $pad * 2) $radius
  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 20, 32, 26),
    [System.Drawing.Color]::FromArgb(255, 8, 15, 11),
    55
  )
  $g.FillPath($brush, $path)

  $outline = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(46, 226, 244, 235), [single][Math]::Max(1, $size * 0.005))
  $g.DrawPath($outline, $path)

  $stroke = [single][Math]::Max(2.0, $size * 0.052)
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 184, 240, 212), $stroke)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $points = New-Object 'System.Collections.Generic.List[System.Drawing.PointF]'
  $count = 40
  for ($i = 0; $i -le $count; $i++) {
    $t = $i / $count
    $x = $size * 0.14 + $size * 0.72 * $t
    $y = $size * 0.52 - [Math]::Sin($t * [Math]::PI * 2.0) * $size * 0.15
    $points.Add((New-Object System.Drawing.PointF([single]$x, [single]$y)))
  }
  $g.DrawCurve($pen, $points.ToArray(), 0.55)

  $dotSize = [single]($size * 0.085)
  $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 246, 248, 242))
  $g.FillEllipse($dotBrush, $size * 0.795, $size * 0.27, $dotSize, $dotSize)

  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $pen.Dispose()
  $brush.Dispose()
  $outline.Dispose()
  $dotBrush.Dispose()
  $path.Dispose()
}

New-HushIcon 512 (Join-Path $assets "icon.png")
New-HushIcon 32 (Join-Path $assets "tray.png")
New-HushIcon 64 (Join-Path $assets "tray@2x.png")
Get-ChildItem $assets | Select-Object Name, Length
