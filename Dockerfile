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
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "CatalogueApi.dll"]
