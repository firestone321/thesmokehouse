$envfile = "c:\Users\Jurug\OneDrive\VS Code\Web Development\thesmokehouse-admin\.env.local"
if (-not (Test-Path $envfile)) { Write-Error "Env file not found: $envfile"; exit 1 }

$lines = Get-Content $envfile

# get supabase url
$url = $null
foreach ($l in $lines) {
  if ($l -match '^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*"?([^"]+)"?\s*$') { $url = $matches[1]; break }
  if ($l -match '^\s*SUPABASE_URL\s*=\s*"?([^"]+)"?\s*$') { $url = $matches[1]; break }
}
if (-not $url) { Write-Error "SUPABASE URL not found in env file"; exit 1 }

# get key
$key = $null
foreach ($l in $lines) {
  if ($l -match '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*"?([^"]+)"?\s*$') { $key = $matches[1]; break }
  if ($l -match '^\s*SUPABASE_SECRET_KEY\s*=\s*"?([^"]+)"?\s*$') { $key = $matches[1]; break }
  if ($l -match '^\s*SUPABASE_ANON_KEY\s*=\s*"?([^"]+)"?\s*$') { $key = $matches[1]; break }
}
if (-not $key) { Write-Error "Supabase key not found in env file"; exit 1 }

$headers = @{ 'apikey' = $key; 'Authorization' = 'Bearer ' + $key; 'Accept' = 'application/json' }

# fetch menu
$menuUri = "$url/rest/v1/menu_items?select=id,code,name,portion_type_id,menu_categories(code,name),is_active,is_available_today&order=sort_order"
Write-Output "Fetching menu items..."
Write-Output ("menuUri: " + $menuUri)
Write-Output "Fetching a simple menu preview (id,name)..."
try {
  $preview = Invoke-RestMethod -Uri "$url/rest/v1/menu_items?select=id,name&limit=3" -Headers $headers -Method Get
  Write-Output '--- menu preview ---'
  $preview | ConvertTo-Json -Depth 4 | Write-Output
} catch {
  Write-Error "Menu preview fetch failed: $_"
}
try {
  $menu = Invoke-RestMethod -Uri $menuUri -Headers $headers -Method Get
} catch {
  Write-Error "Menu fetch failed: $_"; exit 1
}
Write-Output ("Fetched " + ($menu | Measure-Object).Count + " rows")

$fries = $menu | Where-Object { ($_.code -eq 'fries_250g') -or ($_.name -match '(?i)fries') }
Write-Output '--- Fries-like menu rows ---'
foreach ($f in $fries) {
  Write-Output ("id=$($f.id) code=$($f.code) name=$($f.name) portion_type_id=$($f.portion_type_id) active=$($f.is_active) available_today=$($f.is_available_today)")
}

$accom = $menu | Where-Object {
  $_.menu_categories -and (
    ($_.menu_categories.code -eq 'accompaniments') -or
    ($_.menu_categories[0] -and $_.menu_categories[0].code -eq 'accompaniments')
  )
}
Write-Output '--- accompaniments rows ---'
foreach ($a in $accom) {
  Write-Output ("id=$($a.id) code=$($a.code) name=$($a.name) portion_type_id=$($a.portion_type_id) active=$($a.is_active) available_today=$($a.is_available_today)")
}

$portionIds = $menu | ForEach-Object { $_.portion_type_id } | Where-Object { $_ -ne $null } | Select-Object -Unique
if ($portionIds.Count -eq 0) { Write-Output 'No portion_type_ids found for menu items'; exit 0 }
$idsQuery = ($portionIds -join ',')

$today = (Get-Date).ToString('yyyy-MM-dd')
Write-Output ("Querying daily_stock and finished_stock for portion ids: " + $idsQuery)

$dailyUri = "$url/rest/v1/daily_stock?select=stock_date,portion_type_id,starting_quantity,reserved_quantity,sold_quantity,waste_quantity,remaining_quantity&stock_date=eq.$today&in=portion_type_id.($idsQuery)"
try {
  $daily = Invoke-RestMethod -Uri $dailyUri -Headers $headers -Method Get
} catch {
  Write-Error "daily_stock fetch failed: $_"; $daily = @()
}

Write-Output '--- daily_stock rows ---'
$daily | ConvertTo-Json -Depth 4 | Write-Output

$finishedUri = "$url/rest/v1/finished_stock?select=portion_type_id,current_quantity&in=portion_type_id.($idsQuery)"
try {
  $finished = Invoke-RestMethod -Uri $finishedUri -Headers $headers -Method Get
} catch {
  Write-Error "finished_stock fetch failed: $_"; $finished = @()
}

Write-Output '--- finished_stock rows ---'
$finished | ConvertTo-Json -Depth 4 | Write-Output
