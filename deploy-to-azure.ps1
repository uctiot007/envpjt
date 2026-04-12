# Deploy to Azure App Service
# Run this script in PowerShell after logging in to Azure

# Variables - customize these
$appName = "CrackStore"  # Choose a unique name
$resourceGroup = "CrackStore-rg"  # Choose a name
$location = "East US 2"  # Choose an allowed location

# Path to Azure CLI
$azPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

# Login to Azure (if not already)
& $azPath login

# Create resource group
& $azPath group create --name $resourceGroup --location $location

# Create App Service plan
& $azPath appservice plan create --name "$appName-plan" --resource-group $resourceGroup --sku FREE --location $location

# Create web app
& $azPath webapp create --name $appName --resource-group $resourceGroup --plan "$appName-plan" --runtime "NODE:18-lts"

# Set environment variables (add your .env variables here)
& $azPath webapp config appsettings set --name $appName --resource-group $resourceGroup --setting "AZURE_STORAGE_CONNECTION_STRING=$env:AZURE_STORAGE_CONNECTION_STRING"
& $azPath webapp config appsettings set --name $appName --resource-group $resourceGroup --setting "JWT_SECRET=$env:JWT_SECRET"
& $azPath webapp config appsettings set --name $appName --resource-group $resourceGroup --setting "MONGODB_URI=$env:MONGODB_URI"
# Add other env vars as needed

# Deploy the app
& $azPath webapp up --name $appName --resource-group $resourceGroup --src-path . --runtime "NODE:18-lts"

# Get the URL
& $azPath webapp show --name $appName --resource-group $resourceGroup --query "defaultHostName" -o tsv