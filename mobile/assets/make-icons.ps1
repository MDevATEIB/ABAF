# Genere les assets d'icone provisoires d'ABAF Terrain (a remplacer par un vrai graphisme).
Add-Type -AssemblyName System.Drawing

$vert = [System.Drawing.Color]::FromArgb(20, 83, 45)   # #14532d
$blanc = [System.Drawing.Color]::White

function New-Canvas([int]$size, [bool]$transparent) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  if (-not $transparent) {
    $b = New-Object System.Drawing.SolidBrush($vert)
    $g.FillRectangle($b, 0, 0, $size, $size)
    $b.Dispose()
  }
  return @($bmp, $g)
}

function Draw-Emblem($g, [int]$size, [int]$cx, [int]$cy, [int]$r) {
  # Boule de coton : un grand cercle blanc + lettre A verte, patte de camion en dessous.
  $w = New-Object System.Drawing.SolidBrush($blanc)
  $g.FillEllipse($w, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2))
  $v = New-Object System.Drawing.SolidBrush($vert)
  $g.FillRectangle($v, ($cx - [int]($r * 0.9)), ($cy + $r), [int]($r * 1.8), [int]($r * 0.45))
  $rouge = New-Object System.Drawing.SolidBrush($blanc)
  $g.FillEllipse($rouge, ($cx - [int]($r * 0.55)), [int]($cy + $r * 1.35), [int]($r * 0.5), [int]($r * 0.5))
  $g.FillEllipse($rouge, ($cx + [int]($r * 0.05)), [int]($cy + $r * 1.35), [int]($r * 0.5), [int]($r * 0.5))
  $police = New-Object System.Drawing.Font('Arial', ($r * 1.1), [System.Drawing.FontStyle]::Bold)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(($cx - $r), ($cy - $r), ($r * 2), ($r * 2))
  $g.DrawString('A', $police, $v, $rect, $sf)
  $police.Dispose(); $w.Dispose(); $v.Dispose(); $rouge.Dispose()
}

function Save-Png($bmp, $g, $path) {
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "ecrit : $path"
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

# icon.png — 1024, fond vert plein
$r = New-Canvas 1024 $false
Draw-Emblem $r[1] 1024 512 430 200
Save-Png $r[0] $r[1] (Join-Path $dir 'icon.png')

# adaptive-icon.png — 1024, fond transparent, emblem reduit (zone sure)
$r = New-Canvas 1024 $true
Draw-Emblem $r[1] 1024 512 450 150
Save-Png $r[0] $r[1] (Join-Path $dir 'adaptive-icon.png')

# splash-icon.png — 512, fond transparent
$r = New-Canvas 512 $true
Draw-Emblem $r[1] 512 256 215 90
Save-Png $r[0] $r[1] (Join-Path $dir 'splash-icon.png')
