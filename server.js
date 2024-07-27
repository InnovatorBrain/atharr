const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')('your_stripe_secret_key');
const crypto = require('crypto');
const https = require('https');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const Jazzcash = {
    config: {
        merchantId: '',
        password: '',
        hashKey: '',
    },
    url: '',
    error: false,
    secureHash: '',
    initialized: false,
    environment: 'sandbox',
    liveURL: 'https://payments.jazzcash.com.pk',
    sandboxURL: 'https://sandbox.jazzcash.com.pk',
    data: {

        "pp_Version": "2.0",
        "pp_IsRegisteredCustomer": "Yes",
        "pp_ShouldTokenizeCardNumber": "Yes",
        "pp_TxnType": "MPAY",
        "pp_TxnRefNo": "T20221125153224",
        "pp_MerchantID": "Test00127801",
        "pp_Password": "0123456789",
        "pp_Amount": "20000",
        "pp_TxnCurrency": "PKR",
        "pp_TxnDateTime": "20221125153215",
        "pp_TxnExpiryDateTime": "20221202153215",
        "pp_BillReference": "billRef",
        "pp_Description": "Description of transaction",
        "pp_TokenizedCardNumber": "9228924639592086",
        "pp_UsageMode": "API",
        "pp_SecureHash": ""

        // pp_Version: '',
        // pp_TxnType: '',
        // pp_Language: '',
        // pp_MerchantID: '',
        // pp_SubMerchantID: '',
        // pp_Password: '',
        // pp_BankID: '',
        // pp_ProductID: '',
        // pp_TxnRefNo: '',
        // pp_Amount: '',
        // pp_TxnCurrency: '',
        // pp_TxnDateTime: '',
        // pp_BillReference: '',
        // pp_Description: '',
        // pp_TxnExpiryDateTime: '',
        // pp_SecureHash: '',
        // pp_MerchantMPIN: '',
        // ppmpf_1: '',
        // ppmpf_2: '',
        // ppmpf_3: '',
        // ppmpf_4: '',
        // ppmpf_5: '',
        // pp_MobileNumber: '',
        // pp_CNIC: '',
    },
    credentials: function (credentials) {
        try {
            const config = credentials.config;
            if (config.merchantId.length && config.password.length && config.hashKey.length) {
                this.config = {
                    merchantId: config.merchantId,
                    password: config.password,
                    hashKey: config.hashKey,
                };
                this.environment = credentials.environment || this.environment;
                this.initialized = true;
            } else {
                throw "Credentials are missing or of invalid length";
            }
        } catch (err) {
            this.catchError(err);
        }
    },
    setData: function (data) {
        if (this.initialized && !this.error) {
            this.data = {
                pp_Version: data.pp_Version || "1.1",
                pp_TxnType: data.pp_TxnType || "",
                pp_Language: data.pp_Language || "EN",
                pp_MerchantID: this.config.merchantId,
                pp_SubMerchantID: data.pp_SubMerchantID || "",
                pp_ReturnURL: data.pp_ReturnURL || "",
                pp_Password: this.config.password,
                pp_BankID: data.pp_BankID || "",
                pp_ProductID: data.pp_ProductID || "",
                pp_TxnRefNo: data.pp_TxnRefNo || "T" + new Date().getTime(),
                pp_Amount: data.pp_Amount * 100,
                pp_TxnCurrency: data.pp_TxnCurrency || "PKR",
                pp_TxnDateTime: data.pp_TxnDateTime || getDateTime(),
                pp_BillReference: data.pp_BillReference || "",
                pp_Description: data.pp_Description || "",
                pp_TxnExpiryDateTime: data.pp_TxnExpiryDateTime || getDateTime(3),
                ppmpf_1: data.ppmpf_1 || "",
                ppmpf_2: data.ppmpf_2 || "",
                ppmpf_3: data.ppmpf_3 || "",
                ppmpf_4: data.ppmpf_4 || "",
                ppmpf_5: data.ppmpf_5 || "",
                pp_MobileNumber: data.pp_MobileNumber || "",
                pp_CNIC: data.pp_CNIC || "",
            };
        } else {
            this.catchError("Jazzcash is not initialized properly to set data.");
        }
    },
    createRequest: async function (request) {
        if (this.initialized && !this.error) {
            if (this.createHash(request)) {
                const data = {};
                const dataFields = this.fields[request];
                dataFields.forEach((item) => {
                    data[item] = this.data[item];
                });
                data.pp_SecureHash = this.secureHash;

                if (request == "PAY") {
                    return data;
                } else {
                    const dataString = JSON.stringify(data);
                    const options = {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Content-Length": dataString.length,
                        },
                    };
                    const response = await this.httpRequest(this.url, options, dataString);
                    return JSON.parse(response);
                }
            }
        } else {
            this.catchError("Jazzcash is not initialized properly to create a request.");
        }
    },
    createHash: function (request) {
        if (this.initialized && !this.error) {
            this.data.pp_SecureHash = "";
            let secureHash = this.config.hashKey + "&";
            this.fields[request].forEach((item) => {
                secureHash += this.data[item] + "&";
            });
            secureHash = secureHash.slice(0, -1);
            this.secureHash = crypto.createHash("sha256").update(secureHash).digest("hex");
            return true;
        }
        return false;
    },
    httpRequest: function (url, options, dataString) {
        return new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });
                res.on("end", () => {
                    resolve(data);
                });
            });

            req.on("error", (error) => {
                reject(error);
            });

            req.write(dataString);
            req.end();
        });
    },
    catchError: function (err) {
        this.error = true;
        console.error("Error: ", err);
    },
    fields: {
        PAY: [
            "pp_Version",
            "pp_TxnType",
            "pp_Language",
            "pp_MerchantID",
            "pp_SubMerchantID",
            "pp_ReturnURL",
            "pp_Password",
            "pp_BankID",
            "pp_ProductID",
            "pp_TxnRefNo",
            "pp_Amount",
            "pp_TxnCurrency",
            "pp_TxnDateTime",
            "pp_BillReference",
            "pp_Description",
            "pp_TxnExpiryDateTime",
            "pp_SecureHash",
            "ppmpf_1",
            "ppmpf_2",
            "ppmpf_3",
            "ppmpf_4",
            "ppmpf_5",
            "pp_MobileNumber",
            "pp_CNIC",
        ],
    },
};

// Stripe payment route
app.post('/checkout-stripe', async (req, res) => {
    try {
        const { token, amount } = req.body;
        const charge = await stripe.charges.create({
            amount,
            currency: 'usd',
            source: token,
            description: 'Test charge',
        });
        res.send(charge);
    } catch (error) {
        res.status(500).send(error);
    }
});

// JazzCash payment route
app.post('/checkout-jazzcash', async (req, res) => {
    try {
        const { amount, address } = req.body;
        Jazzcash.credentials({
            config: {
                merchantId: 'Test00127801',
                password: '0123456789',
                hashKey: 'your_hash_key',
            },
            environment: 'sandbox', // or 'live'
        });

        Jazzcash.setData({
            pp_Amount: amount,
            pp_TxnCurrency: 'PKR',
            pp_TxnDateTime: getDateTime(),
            pp_TxnExpiryDateTime: getDateTime(3),
            pp_BillReference: 'bill_ref',
            pp_Description: 'Test transaction',
            pp_TxnRefNo: 'T' + new Date().getTime(),
        });

        const requestData = await Jazzcash.createRequest('PAY');
        res.send(requestData);
    } catch (error) {
        res.status(500).send(error);
    }
});

function getDateTime(day) {
    let date = new Date();
    let dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let arr = dateStr.split('/');
    let d = parseInt(arr[0]) + (day || 0);
    let m = arr[1];
    let y = arr[2];

    let timeStr = date.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let arr2 = timeStr.split(':');
    let H = arr2[0];
    let i = arr2[1];
    let s = arr2[2];

    let ymdHms = y + m + d + H + i + s;
    return ymdHms;
}

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});

module.exports = app;
