const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const app = express();

const JAZZCASH_MERCHANT_ID = "94669";
const JAZZCASH_PASSWORD = "0123456789";
const JAZZCASH_INTEGRITY_SALT = "0123456789";
const JAZZCASH_RETURN_URL = "http://localhost:3000/";

app.use(bodyParser.urlencoded({ extended: false }));

app.get('/checkout', (req, res) => {
    const product_name = "Subscribe Webcog";
    const product_price = 100;

    const pp_Amount = parseInt(product_price * 100); // JazzCash expects amount in paisas
    const current_datetime = new Date();
    const pp_TxnDateTime = formatDate(current_datetime);

    const expiry_datetime = new Date(current_datetime.getTime() + 60 * 60 * 1000);
    const pp_TxnExpiryDateTime = formatDate(expiry_datetime);

    const pp_TxnRefNo = "T" + pp_TxnDateTime;

    const post_data = {
        pp_Version: "1.0",
        pp_TxnType: "",
        pp_Language: "EN",
        pp_MerchantID: JAZZCASH_MERCHANT_ID,
        pp_SubMerchantID: "",
        pp_Password: JAZZCASH_PASSWORD,
        pp_BankID: "TBANK",
        pp_ProductID: "RETL",
        pp_TxnRefNo: pp_TxnRefNo,
        pp_Amount: pp_Amount,
        pp_TxnCurrency: "PKR",
        pp_TxnDateTime: pp_TxnDateTime,
        pp_BillReference: "billRef",
        pp_Description: "Description of transaction",
        pp_TxnExpiryDateTime: pp_TxnExpiryDateTime,
        pp_ReturnURL: JAZZCASH_RETURN_URL,
        pp_SecureHash: "",
        ppmpf_1: "1",
        ppmpf_2: "2",
        ppmpf_3: "3",
        ppmpf_4: "4",
        ppmpf_5: "5"
    };

    const sortedString = Object.keys(post_data)
        .sort()
        .map(key => `${key}=${post_data[key]}`)
        .join('&');

    const pp_SecureHash = crypto.createHmac('sha256', JAZZCASH_INTEGRITY_SALT)
        .update(sortedString)
        .digest('hex');
    
    post_data.pp_SecureHash = pp_SecureHash;

    res.render('frontend.ejs', {
        product_name,
        product_price,
        post_data
    });
});

app.post('http://localhost:3000/', (req, res) => {
    res.render('success.ejs');
});

function formatDate(date) {
    const yyyy = date.getFullYear().toString();
    const MM = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const HH = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    const ss = date.getSeconds().toString().padStart(2, '0');
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
}

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
