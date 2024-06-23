const express = require("express");
const router = express.Router();
const Joi = require("joi");
const lodash = require("lodash");

const {
  getAllCustomers,
  getCustomer,
  createCustomer,
  checkForDuplicates,
  getSecondaryCustomers,
  updateCustomer,
  updateMissingValuesInCustomer,
  getLinkedPrimaryRecordsAndUpdate,
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
  console.log(`${new Date()}: Request Body:-`, req.body);

  let { error } = ValidationCheck(req.body);
  if (error)
    return res.status(400).send({ ErrorMessage: error.details[0].message });

  let contact = {
    phoneNumber: req?.body?.phoneNumber || null,
    email: req?.body?.email || null,
    linkP: "primary",
    linkedId: null,
  };

  if (!contact.phoneNumber && !contact.email)
    return res
      .status(400)
      .send({ ErrorMessage: "Either 'email' or 'phoneNumber' is Required." });

  const allRecordsMatch = await checkForDuplicates(
    contact.phoneNumber,
    contact.email
  );

  //Logic Starts
  let primaryID;
  let createContact = true;
  let updatePrimaryToSecondaryIDs = [];
  let theFullLinkedRecordList = [];
  let allEmails = [];
  let allPhones = [];
  let allSecondaryIDs = [];

  if (allRecordsMatch.length > 0) {
    let linkedIDs = Array.from(
      new Set(
        allRecordsMatch.map((item) => item.linkedId).filter((id) => id !== null)
      )
    );
    //console.log("Linked IDs:", linkedIDs);

    if (linkedIDs.length > 0) {
      for (ids in linkedIDs) {
        theFullLinkedRecordList.push(
          ...(await getSecondaryCustomers(linkedIDs[ids]))
        );
      }
    }

    //console.log("All Records 123", allRecordsMatch);

    let noDuplicaeteAllList = lodash
      .uniqBy([...theFullLinkedRecordList, ...allRecordsMatch], (item) =>
        JSON.stringify(item)
      )
      .sort(
        (item1, item2) =>
          lodash.get(item1, "createdAt") - lodash.get(item2, "createdAt")
      );

    //console.log("noDuplicaeteAllList", noDuplicaeteAllList);

    let primaryDuplicates = Array.from(
      new Set(noDuplicaeteAllList.filter((d) => d.linkPrecedence == "primary"))
    );

    console.log(`${new Date()}: multiple primary check :-`, primaryDuplicates);

    if (primaryDuplicates.length > 0) {
      primaryID = primaryDuplicates[0].id;
      if (primaryDuplicates.length > 1) {
        for (let count = 1; count < primaryDuplicates.length; count++) {
          updatePrimaryToSecondaryIDs.push(primaryDuplicates[count].id);
        }

        //get all the secondries across all logics and update their linked id to the primary id and linked precidence to secondary. and get the list of all the records.

        theFullLinkedRecordList.push(
          ...(await getLinkedPrimaryRecordsAndUpdate(
            updatePrimaryToSecondaryIDs,
            primaryID
          ))
        );
      }

      //console.log("updatePrimaryToSecondaryIDs", updatePrimaryToSecondaryIDs);

      if (updatePrimaryToSecondaryIDs.length == 0) {
        theFullLinkedRecordList.push(
          ...(await getSecondaryCustomers(primaryID))
        );
      }
    }

    //iterate through the entire list and apply the checking logics.

    console.log(`${new Date()}: Final Full List:-`, theFullLinkedRecordList);

    for (row in theFullLinkedRecordList) {
      if (
        (theFullLinkedRecordList[row].email === contact.email &&
          theFullLinkedRecordList[row].phoneNumber == contact.phoneNumber) ||
        (!contact.email &&
          theFullLinkedRecordList[row].phoneNumber == contact.phoneNumber) ||
        (theFullLinkedRecordList[row].email === contact.email &&
          !contact.phoneNumber)
      ) {
        createContact = false;
      }

      //email Push
      if (
        theFullLinkedRecordList[row].email &&
        !allEmails.includes(theFullLinkedRecordList[row].email)
      ) {
        allEmails.push(theFullLinkedRecordList[row].email);
      }

      if (
        theFullLinkedRecordList[row].phoneNumber &&
        !allPhones.includes(theFullLinkedRecordList[row].phoneNumber)
      )
        //phone Push
        allPhones.push(theFullLinkedRecordList[row].phoneNumber);
      //secondary ID Push
      if (
        theFullLinkedRecordList[row].linkPrecedence == "primary" &&
        !primaryID
      ) {
        primaryID = theFullLinkedRecordList[row].id;
      } else if (
        theFullLinkedRecordList[row].linkPrecedence != "primary" &&
        !allSecondaryIDs.includes(theFullLinkedRecordList[row].id)
      ) {
        allSecondaryIDs.push(theFullLinkedRecordList[row].id);
      }
    }

    if (createContact) {
      contact.linkP = "secondary";
      contact.linkedId = primaryID;
    }
  }

  if (createContact) {
    console.log(`${new Date()}: creating new record:-`, contact);
    const createdContactDetails = await createCustomer(contact);
    //mappings
    if (!primaryID) {
      primaryID = createdContactDetails.id;
    } else {
      allSecondaryIDs.push(createdContactDetails.id);
    }
    if (
      createdContactDetails.email &&
      !allEmails.includes(createdContactDetails.email)
    )
      allEmails.push(createdContactDetails.email);
    if (
      createdContactDetails.phoneNumber &&
      !allPhones.includes(createdContactDetails.phoneNumber)
    )
      allPhones.push(createdContactDetails.phoneNumber);
  }

  let finalResponse = {
    contact: {
      primaryContatctId: primaryID,
      emails: allEmails,
      phoneNumbers: allPhones,
      secondaryContactIds: allSecondaryIDs,
    },
  };

  res.status(200).send(finalResponse);
});

//----------------Validation Function---------------------

function ValidationCheck(reqBody) {
  const schema = Joi.object({
    phoneNumber: Joi.string()
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
