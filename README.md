# Identity-Reconciliation


# Overview

This project implements identity reconciliation for Bitespeed, linking customer profiles.
Leverages email or phone number for matching Contact entries in a relational database.
Establishes a primary identity for each customer by designating the oldest Contact record.
<br />
<br />
_(Made as a task for Bitespeed Software Engineer(Backend) Role)_

# API Details:

**METHOD:** POST <br />
**BASE_URL:** https://identity-reconciliation-api-5wxq.onrender.com/api <br />
**ENDPOINT:** /identify <br />
**PAYLOAD:**  <br />
```
{
  "email"?: string,
  "phoneNumber"?: number
}
``` 

**EXPECTED_RESPONSE_FORMAT:** 

```
{
  "contact":
  {
    "primaryContatctId": number,
    "emails": string[], // first element being email of primary contact
    "phoneNumbers": string[], // first element being phoneNumber of primary conta
    "secondaryContactIds": number[] // Array of all Contact IDs that are "secondary"
  }
}
```

_*You can also use the GET method with the '/identify' and '/identify/:id' endpoints to get the data in the database.(just to check the values in db)_



# Steps to set-up locally

1. Clone the project
 ```
git clone https://github.com/gilbertraju/-Identity-Reconciliation.git
``` 
2. Install all the dependencies:
```
npm install
```
3. Create a .env file with the below variables.
 ```
MYSQL_HOST=''
MYSQL_USER= ''
MYSQL_PASSWORD=''
MYSQL_DB=''
MYSQL_PORT=''
 ```
5. Run the below SQL commands to set-up the db and table locally.
```
CREATE DATABASE customer_details;

USE customer_details;

CREATE TABLE customer (
id INTEGER PRIMARY KEY auto_increment,
phoneNumber VARCHAR(255),
email VARCHAR(255),
linkedId INTEGER,
linkPrecedence VARCHAR(100),
createdAt TIMESTAMP NOT NULL default now()
);

```

6. Run the project.
```
npm start
```
