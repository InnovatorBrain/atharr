// Create a Stripe client.
const stripe = Stripe(stripePublishableKey);

// Create an instance of Elements.
const elements = stripe.elements();

const style = {
  base: {
    color: "#32325d",
    fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
    fontSmoothing: "antialiased",
    fontSize: "16px",
  },
  invalid: {
    color: "#fa755a",
    iconColor: "#fa755a",
  },
};

// Create an instance of the card Element.
const card = elements.create("card", { style: style });

// Add an instance of the card Element into the `card-element` <div>.
card.mount("#card-element");

// Handle real-time validation errors from the card Element.
card.addEventListener("change", function (event) {
  const displayError = document.getElementById("card-errors");
  if (event.error) {
    displayError.textContent = event.error.message;
  } else {
    displayError.textContent = "";
  }
});

// Handle form submission.
const $form = $("#checkout-form");

$form.submit(function (event) {
  event.preventDefault();
  $form.find("button").prop("disabled", true);

  const extraDetails = {
    name: $("#card-name").val(),
  };

  stripe.createToken(card, extraDetails).then(function (result) {
    if (result.error) {
      const displayError = document.getElementById('card-errors');
      displayError.textContent = result.error.message;
      $form.find("button").prop("disabled", false); // Re-enable submission
    } else {
      // Send the token to your server.
      stripeTokenHandler(result.token);
    }
  });
});

// Submit the form with the token ID.
function stripeTokenHandler(token) {
  // Insert the token ID into the form so it gets submitted to the server
  $form.append($('<input type="hidden" name="stripeToken" />').val(token.id));
  // Submit the form
  $form.get(0).submit();
}




// ------------------JazzCash Payment Gateway-----------------------
// Initialize JazzCash
const Jazzcash = require('jazzcash-checkout');
const jazzcashClient = new Jazzcash();

// Handle form submission.

$form.submit(function (event) {
  event.preventDefault();
  $form.find("button").prop("disabled", true);

  // Check if the payment method is Stripe or JazzCash
  const paymentMethod = $('input[name=paymentMethod]:checked').val(); // Assuming you have a radio button to select payment method

  if (paymentMethod === 'stripe') {
    const extraDetails = {
      name: $("#card-name").val(),
    };

    stripe.createToken(card, extraDetails).then(function (result) {
      if (result.error) {
        const displayError = document.getElementById('card-errors');
        displayError.textContent = result.error.message;
        $form.find("button").prop("disabled", false); // Re-enable submission
      } else {
        // Send the token to your server.
        stripeTokenHandler(result.token);
      }
    });
  } else if (paymentMethod === 'jazzcash') {
    // Prepare JazzCash data
    const jazzcashData = {
      pp_Amount: cart.totalCost * 100, // Assuming cart is defined somewhere
      pp_BillReference: "billRef123",
      pp_Description: "Test Payment",
      pp_MobileNumber: "03123456789",
      pp_CNIC: "345678",
    };

    // Create a JazzCash request
    jazzcashClient.createRequest("WALLET").then((res) => {
      // Handle JazzCash response
      res = JSON.parse(res); // Parse the response if necessary
      console.log(res);
      // Handle the response accordingly (e.g., redirect user to JazzCash checkout page)
    });
  }
});

// Submit the form with the token ID.
function stripeTokenHandler(token) {
  // Insert the token ID into the form so it gets submitted to the server
  $form.append($('<input type="hidden" name="stripeToken" />').val(token.id));
  // Submit the form
  $form.get(0).submit();
}
