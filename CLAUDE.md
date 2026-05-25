# PROJECT INFORMATION AND METHODOLOGY

## Database
This is a Postgresql database running on Google Cloud SQL.
The database is called "littleberry".  
the connection details are
* server:  34.71.204.192
* db: littleberry
* user: littleberry-web
* password: overlaid-ramble-remember-giggly-protract-mantis
Both the development and production system use this same server.

### General Rules about the Database
Always prompt for permission any time you intend to change data or structure.



## API Server
the api server is located here:  ./api/catalogue
it is a c# webapi.  Locally, it runs here: http://localhost:5200 In production we use a docker container and it runs under https://littleberry.org/api

### General Rules about the API Server
always restart the api server after making a change to the api server code.

