const express = require("express");
const router = express.Router();
const Joi = require("joi");

const {
  getAllCustomers,
  getCustomer,
  createCustomer,
  checkForDuplicates,
  getSecondaryCustomers,
  updateCustomer,
  updateMissingValuesInCustomer,
} = require("../database");

//==========================GET=============================//

router.get("/", async (req, res) => {
  const customers = await getAllCustomers();
  res.status(200).json(customers);
  //res.send("API get request in /identify");
});

router.get("/:id", async (req, res) => {
  const requestedPerson = await getCustomer(req.params.id);

  if (!requestedPerson || typeof requestedPerson == "undefined")
    return res
      .status(404)
      .send({ ErrorMessage: "No Contact found with the given ID" });

  //
  res.status(200).json(requestedPerson);
  //res.send("API get request in /identify");
});

/**
 * 
 * @returns  
 * {
     contact: {
       primaryContatctId: 1,
       emails: [],
       phoneNumbers: [],
       secondaryContactIds: [],
     },
   };
 */

router.post("/", async (req, res) => {
  let finalResponse = {};
  let primaryId;
  let allEmails = [];
  let allPhones = [];
  let allSecondaryIDs = [];

  let updateContacts = [];

  let updateId;

  let createContactWithThisRequestQuestionMark = true;
  let updateContactQuestionMark = false;
  let { error } = ValidationCheck(req.body);
  if (error)
    return res.status(400).send({ ErrorMessage: error.details[0].message });
  let contact = {
    phone: req?.body?.phone || null,
    email: req?.body?.email || null,
    linkP: "primary",
    linkedId: null,
  };

  if (!contact.phone && !contact.email)
    return res
      .status(400)
      .send({ ErrorMessage: "Either 'email' or 'phone' is Required." });

  const duplicates = await checkForDuplicates(contact.phone, contact.email);

  console.log("Duplicate List:", duplicates);

  if (duplicates.length >= 1) {
    console.log("Match Found");
    let doesLinkedIdExistInDuplicates = true;

    for (row in duplicates) {
      if (
        (duplicates[row].email === contact.email &&
          duplicates[row].phoneNumber == contact.phone) ||
        (!contact.email && duplicates[row].phoneNumber == contact.phone) ||
        (duplicates[row].email === contact.email && !contact.phone)
      ) {
        createContactWithThisRequestQuestionMark = false;
      }

      if (
        (!duplicates[row].phoneNumber &&
          contact.phone &&
          duplicates[row].email === contact.email) ||
        (!duplicates[row].email &&
          contact.email &&
          duplicates[row].phoneNumber == contact.phone)
      ) {
        updateContacts.push({
          phone: contact.phone,
          email: contact.email,
          id: duplicates[row].id,
        });
      }

      if (duplicates[row].email) allEmails.push(duplicates[row].email);

      if (duplicates[row].phoneNumber)
        allPhones.push(duplicates[row].phoneNumber);

      if (duplicates[row].linkedId) {
        primaryId = duplicates[row].linkedId;
        doesLinkedIdExistInDuplicates = true;
      }

      if (duplicates[row].linkPrecedence == "primary") {
        primaryId = duplicates[row].id;
      } else {
        allSecondaryIDs.push(duplicates[row].id);
      }
    }

    // if (
    //   allEmails.includes(contact.email) &&
    //   allPhones.includes(contact.phone) &&
    //   createContactWithThisRequestQuestionMark
    // ) {
    //   console.log("Edge Case Hit");
    //   createContactWithThisRequestQuestionMark = false;

    //   console.log("duplicates", duplicates);

    // }

    if (doesLinkedIdExistInDuplicates) {
      const secondaryAndPrimaryContactList = await getSecondaryCustomers(
        primaryId
      );
      console.log("All the Secondary Contacts", secondaryAndPrimaryContactList);

      for (secondaryContact in secondaryAndPrimaryContactList) {
        if (secondaryAndPrimaryContactList[secondaryContact].email)
          allEmails.push(
            secondaryAndPrimaryContactList[secondaryContact].email
          );

        if (secondaryAndPrimaryContactList[secondaryContact].phoneNumber)
          allPhones.push(
            secondaryAndPrimaryContactList[secondaryContact].phoneNumber
          );

        if (
          secondaryAndPrimaryContactList[secondaryContact].linkPrecedence !=
          "primary"
        )
          allSecondaryIDs.push(
            secondaryAndPrimaryContactList[secondaryContact].id
          );
      }
    }

    if (createContactWithThisRequestQuestionMark) {
      contact.linkP = "secondary";
      contact.linkedId = primaryId;

      let primaryDuplicates = duplicates.filter((d) => {
        return d.linkPrecedence == "primary";
      });
      console.log("primaryDuplicates", primaryDuplicates);

      if (primaryDuplicates.length > 1 && primaryDuplicates[0].id) {
        console.log("Edge Case Hit");
        createContactWithThisRequestQuestionMark = false;
        updateId = primaryDuplicates[0].id;
        updateContactQuestionMark = true;
      }
    }
  }

  //update
  if (updateContactQuestionMark) {
    console.log("Updating Row with ID", updateId);
    allSecondaryIDs.push(updateId);
    const upadtedContactDetails = await updateCustomer(
      "secondary",
      primaryId,
      updateId
    );

    console.log("Updated Contact", upadtedContactDetails);
  }

  if (updateContacts.length > 0) {
    console.log("Updating Rows", updateContacts);

    let updatePromise = [];
    for (rowThatNeedsUpdate in updateContacts) {
      updatePromise.push(
        updateMissingValuesInCustomer(updateContacts[rowThatNeedsUpdate])
      );
    }

    const upadteMissingValuesResponse = await Promise.allSettled(updatePromise);
    console.log("upadteMissingValuesResponse", upadteMissingValuesResponse);
  }

  //create
  if (
    !allEmails.includes(contact.email) &&
    !allPhones.includes(contact.phone) &&
    createContactWithThisRequestQuestionMark
  ) {
    console.log("Creating New Row", contact);

    const createdContactDetails = await createCustomer(contact);
    //mappings
    if (!primaryId) {
      primaryId = createdContactDetails.id;
    } else {
      allSecondaryIDs.push(createdContactDetails.id);
    }
    if (createdContactDetails.email)
      allEmails.push(createdContactDetails.email);
    if (createdContactDetails.phoneNumber)
      allPhones.push(createdContactDetails.phoneNumber);
  }

  //remove duplicates
  allEmails = removeDuplicates(allEmails);
  allPhones = removeDuplicates(allPhones);
  allSecondaryIDs = removeDuplicates(allSecondaryIDs);

  //finla Response Body Creation
  finalResponse = {
    contact: {
      primaryContatctId: primaryId,
      emails: allEmails,
      phoneNumbers: allPhones,
      secondaryContactIds: allSecondaryIDs,
    },
  };
  console.log(finalResponse);

  res.status(200).send(finalResponse);
});

//----------------Validation Function---------------------

function ValidationCheck(reqBody) {
  const schema = Joi.object({
    phone: Joi.string()
      .allow("")
      .allow(null)
      .min(6)
      .max(12)
      .pattern(/^[0-9]*$/, "Phone Number without CC"),
    email: Joi.string().email().allow("").allow(null),
  });

  return schema.validate(reqBody);
}

module.exports = router;

function removeDuplicates(arr) {
  return arr.filter((item, index) => arr.indexOf(item) === index);
}
