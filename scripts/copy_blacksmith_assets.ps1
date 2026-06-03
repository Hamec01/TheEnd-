$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$src='D:\Downloads\mp3\kuznec'
$root='C:\Users\ham\Documents\TheEnd\apps\frontend\public\art'
$targets=@(
  @{Name='recipe_smelting_metal.png'; Dest='crafting\recipes'; W=768; H=432; ResizeIfLarger=$true},
  @{Name='recipe_material_wood.png'; Dest='crafting\recipes'; W=768; H=432; ResizeIfLarger=$true},
  @{Name='recipe_material_cloth.png'; Dest='crafting\recipes'; W=768; H=432; ResizeIfLarger=$true},
  @{Name='recipe_food_basic.png'; Dest='crafting\recipes'; W=768; H=432; ResizeIfLarger=$true},
  @{Name='recipe_alchemy_basic.png'; Dest='crafting\recipes'; W=768; H=432; ResizeIfLarger=$true},
  @{Name='recipe_forging_weapon.png'; Dest='crafting\recipes'; W=768; H=432; ResizeIfLarger=$true},
  @{Name='recipe_forging_armor.png'; Dest='crafting\recipes'; W=768; H=432; ResizeIfLarger=$true},
  @{Name='recipe_rare_alloy.png'; Dest='crafting\recipes'; W=768; H=432; ResizeIfLarger=$true},
  @{Name='recipe_rune_work.png'; Dest='crafting\recipes'; W=768; H=432; ResizeIfLarger=$true},
  @{Name='forge_background.png'; Dest='blacksmith\scene'; W=1600; H=900; ResizeIfLarger=$true},
  @{Name='furnace_ui.png'; Dest='blacksmith\scene'; W=768; H=768; ResizeIfLarger=$true},
  @{Name='anvil_ui.png'; Dest='blacksmith\scene'; W=768; H=768; ResizeIfLarger=$true},
  @{Name='bellows_ui.png'; Dest='blacksmith\scene'; W=512; H=512; ResizeIfLarger=$true},
  @{Name='quench_vat_ui.png'; Dest='blacksmith\scene'; W=512; H=512; ResizeIfLarger=$true},
  @{Name='blacksmith_forge_objects_sheet_384.png'; Dest='blacksmith\objects'; ResizeIfLarger=$false},
  @{Name='blacksmith_workshop_tools_sheet_256.png'; Dest='blacksmith\tools'; ResizeIfLarger=$false},
  @{Name='crack_small.png'; Dest='blacksmith\effects'; W=256; H=256; ResizeIfLarger=$true},
  @{Name='crack_medium.png'; Dest='blacksmith\effects'; W=256; H=256; ResizeIfLarger=$true},
  @{Name='crack_critical.png'; Dest='blacksmith\effects'; W=256; H=256; ResizeIfLarger=$true},
  @{Name='impurity.png'; Dest='blacksmith\effects'; W=256; H=256; ResizeIfLarger=$true},
  @{Name='warped_metal.png'; Dest='blacksmith\effects'; W=256; H=256; ResizeIfLarger=$true},
  @{Name='overheated.png'; Dest='blacksmith\effects'; W=256; H=256; ResizeIfLarger=$true},
  @{Name='quenched_badly.png'; Dest='blacksmith\effects'; W=256; H=256; ResizeIfLarger=$true},
  @{Name='forge_glow.png'; Dest='blacksmith\effects'; W=512; H=512; ResizeIfLarger=$true},
  @{Name='embers_overlay.png'; Dest='blacksmith\effects'; W=512; H=512; ResizeIfLarger=$true},
  @{Name='sparks_overlay.png'; Dest='blacksmith\effects'; W=512; H=512; ResizeIfLarger=$true},
  @{Name='smoke_overlay.png'; Dest='blacksmith\effects'; W=512; H=512; ResizeIfLarger=$true}
)
function Copy-Image($s,$d,$w,$h,$resize){
  New-Item -ItemType Directory -Path (Split-Path -Parent $d) -Force | Out-Null
  if(-not $resize){ Copy-Item -LiteralPath $s -Destination $d -Force; return 'copied' }
  $img=[System.Drawing.Image]::FromFile($s)
  try {
    if($img.Width -le $w -and $img.Height -le $h){ Copy-Item -LiteralPath $s -Destination $d -Force; return 'copied' }
    $bmp=New-Object System.Drawing.Bitmap($w,$h)
    $gfx=[System.Drawing.Graphics]::FromImage($bmp)
    try {
      $gfx.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $gfx.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $gfx.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $gfx.Clear([System.Drawing.Color]::Transparent)
      $gfx.DrawImage($img,0,0,$w,$h)
      $bmp.Save($d,[System.Drawing.Imaging.ImageFormat]::Png)
      return 'resized'
    } finally { $gfx.Dispose(); $bmp.Dispose() }
  } finally { $img.Dispose() }
}
foreach($t in $targets){
  $source=Join-Path $src $t.Name
  if(-not (Test-Path $source)){ throw "Missing source file: $source" }
  $dest=Join-Path (Join-Path $root $t.Dest) $t.Name
  $mode=Copy-Image $source $dest $t.W $t.H $t.ResizeIfLarger
  $img=[System.Drawing.Image]::FromFile($dest)
  try { Write-Output ("{0}|{1}|{2}x{3}|{4}" -f $t.Name,$t.Dest,$img.Width,$img.Height,$mode) } finally { $img.Dispose() }
}
