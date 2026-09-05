param([int]$skip = 0, [int]$take = 2000, [int]$capPerCat = 200)
$ErrorActionPreference = "Stop"

$feeds = @(
    @{ path = 'Ready to Ship_ Hot Selling Products with MOQ=1.csv'; tag = 'ready' },
    @{ path = 'Trending Products_ Quick Shipping and Guaranteed Arrival!.csv'; tag = 'trend' },
    @{ path = 'Alibaba.com hot-selling Products.csv'; tag = 'hot' }
)

$CATMAP = @{
    'school & office supplies'='Consumer Electronics'
    'consumer electronics'='Consumer Electronics'
    'electronics'='Consumer Electronics'
    'phones & accessories'='Phones & Accessories'
    'apparel'='Apparel & Accessories'
    'fashion'='Apparel & Accessories'
    'shoes & accessories'='Apparel & Accessories'
    'home & garden'='Home & Garden'
    'furniture'='Home & Garden'
    'home appliances'='Home & Garden'
    'beauty & personal care'='Beauty & Personal Care'
    'cosmetics'='Beauty & Personal Care'
    'industrial machinery'='Industrial Machinery'
    'tools'='Industrial Machinery'
    'hardware'='Industrial Machinery'
    'sports & entertainment'='Sports & Entertainment'
    'fitness'='Sports & Entertainment'
    'vehicle parts & accessories'='Vehicle Parts'
    'automobiles & motorcycles'='Vehicle Parts'
    'jewelry & watches'='Jewelry & Watches'
    'toys & hobbies'='Toys & Baby Items'
	'construction & real estate'='Industrial Machinery'
    'fabrication services'='Industrial Machinery'
    'commercial equipment & machinery'='Industrial Machinery'
    'packaging & printing'='Industrial Machinery'
    'jewelry eyewear watches & accessories'='Jewelry & Watches'
    'beauty'='Beauty & Personal Care'
	
}

function Map-Category($cat, $title) {
    if ($CATMAP.ContainsKey($cat)) { return $CATMAP[$cat] }
    $t = $title.ToLower()
    if ($t -match 'dress|gown|fashion|cloth|shirt|jacket') { return 'Apparel & Accessories' }
    if ($t -match 'phone|earphone|headphone|charger|speaker|camera|laptop|led|monitor') { return 'Consumer Electronics' }
    if ($t -match 'sofa|table|chair|lamp|curtain|kitchen|garden|vase') { return 'Home & Garden' }
    if ($t -match 'cream|makeup|lipstick|hair|perfume|beauty') { return 'Beauty & Personal Care' }
    if ($t -match 'tool|machine|motor|pump|weld') { return 'Industrial Machinery' }
    if ($t -match 'car|vehicle|tire|brake|motorcycle|bike') { return 'Vehicle Parts' }
    if ($t -match 'watch|necklace|bracelet|jewel') { return 'Jewelry & Watches' }
    if ($t -match 'toy|doll|baby|kids|game') { return 'Toys & Baby Items' }
    if ($t -match 'sport|fitness|gym|yoga') { return 'Sports & Entertainment' }
    return $null
}

$seen = @{}
$byCat = @{}
if (Test-Path "ali-feed.json") {
    $old = Get-Content "ali-feed.json" -Raw | ConvertFrom-Json
    foreach ($p in $old) {
        $rawId = $p.id -replace '^ali-', ''
        $seen[$rawId] = $true
        if (-not $byCat.ContainsKey($p.category)) { $byCat[$p.category] = @() }
        $byCat[$p.category] += $p
    }
    Write-Host "Loaded $($old.Count) existing products"
}

foreach ($f in $feeds) {
    if (-not (Test-Path $f.path)) {
        Write-Host "Warning: not found: $($f.path)"
        continue
    }
    Write-Host "Mining $($f.tag): slice [$($skip+1)..$($skip+$take)]..."
    $header = Get-Content $f.path -TotalCount 1
    $data = Get-Content $f.path | Select-Object -Skip ($skip + 1) -First $take
    $tmp = "tmp_$($f.tag).csv"
    (@($header) + $data) | Set-Content $tmp -Encoding UTF8

    $added = 0
    foreach ($r in (Import-Csv $tmp)) {
        $id = $r.id
        if (-not $id -or $seen.ContainsKey($id)) { continue }
        $cat = ''
        if ($r.category_name) { $cat = $r.category_name.ToLower().Trim() }
        $catEn = Map-Category $cat $r.title
        if (-not $catEn) { continue }
        if ($byCat.ContainsKey($catEn) -and $byCat[$catEn].Count -ge $capPerCat) { continue }
        $price = 0
        if ($r.price -match '([\d.]+)') { $price = [double]$Matches[1] }
        if (-not $byCat.ContainsKey($catEn)) { $byCat[$catEn] = @() }
        $byCat[$catEn] += [pscustomobject]@{
            id = "ali-$id"
            title = $r.title
            title_ar = ""
            description_ar = ""
            price = $price
            currency = "USD"
            image = $r.image_url
            url = $r.deep_link
            category = $catEn
            feed = $f.tag
            is_real = $true
        }
        $seen[$id] = $true
        $added++
    }
    Remove-Item $tmp
    Write-Host "   +$added products"
}

$items = @()
foreach ($k in $byCat.Keys) { $items += $byCat[$k] }
$items | ConvertTo-Json -Depth 5 -Compress | Set-Content "ali-feed.json" -Encoding UTF8

Write-Host "`nDone: ali-feed.json with $($items.Count) products"
$sortedKeys = $byCat.Keys | Sort-Object
foreach ($k in $sortedKeys) {
    $count = $byCat[$k].Count
    Write-Host "   $k : $count"
}