# Chitchat Backend API

This is the backend API for the Chitchat application. The application is developed as a part of my Final Year Project. Feel free to point out any issue in this package.

## Usage

### Setup Environment variables

```bash
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_NAME
OTP_SECRET
JWT_SECRET_TOKEN
KILL_SWITCH
ABSTRACT_API_KEY
REDIS_DOMAIN_NAME
REDIS_PORT_NUMBER
REDIS_PASSWORD
ENCRYPTION_KEY
ENCRYPT_ALGORITHM
IV_LENGTH
IV
FCM_SERVER_KEY
API_KEY
```

### For development use

```bash
npm install
npm run start
```

### For production use

Modify the package.json file

from

```javascript
"scripts": {
    "start": "nodemon --watch src/**/*.ts --exec ts-node --files src/index.ts",
    "build": "tsc"
  }
```

to

```javascript
"scripts": {
    "start": "node ./build/index.js",
    "build": "tsc"
  }
```

Then run the following command

```javascript
npm install
npm run build
```

Now you can compile all the files together except the "src" folder and run the following command

```javascript
npm run start
// or simply
npm start
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
