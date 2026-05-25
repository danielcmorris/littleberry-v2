FROM node:24-slim AS ui-build
WORKDIR /ui
COPY ui/catalogue/package*.json ./
RUN npm install
COPY ui/catalogue/ .
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY api/catalogue/CatalogueApi/CatalogueApi.csproj api/catalogue/CatalogueApi/
RUN dotnet restore api/catalogue/CatalogueApi/CatalogueApi.csproj
COPY api/catalogue/ api/catalogue/
RUN dotnet publish api/catalogue/CatalogueApi/CatalogueApi.csproj \
    -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
COPY --from=ui-build /ui/dist/catalogue/browser ./wwwroot
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "CatalogueApi.dll"]
