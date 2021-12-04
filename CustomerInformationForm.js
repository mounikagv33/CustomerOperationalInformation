import { LightningElement, wire, api, track } from 'lwc';
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import customerOnboarding from '@salesforce/schema/Customer_Onboarding__c';
import getCustomerOnboardingInfo from '@salesforce/apex/CustomerOperationalInformationForm.getCustomerOnboardingInfo';
import upsertCustomerOperationalInfo from '@salesforce/apex/CustomerOperationalInformationForm.upsertCustomerOperationalInfo';
import COMPANY from '@salesforce/schema/Customer_Onboarding__c.Account_Name__r.Name';
import EDIREQUIRED from '@salesforce/schema/Customer_Onboarding__c.Account_Name__r.Is_EDI_Required__c';
import ACCOUNTNAME from '@salesforce/schema/Customer_Onboarding__c.Account_Name__c';
import timeZone from '@salesforce/schema/Customer_Onboarding__c.Operations_Timezone__c';
import businessDays from '@salesforce/schema/Customer_Onboarding__c.Business_Days__c';
import OPERATIONALPROGRESS from '@salesforce/schema/Customer_Onboarding__c.Operational_Record_Progress_Pick__c';
import { checkNullOrEmptyValues } from 'c/util';
import TMSLabel from '@salesforce/label/c.TMS_None';
import footerTextLabel from '@salesforce/label/c.Customer_Ops_Form_Footer';
import EmailForBillingLabel from '@salesforce/label/c.Field_For_Accessorial_Section_Visibility';
import CUSTOMEROPSFORMERROR from '@salesforce/label/c.Customer_Ops_Form_Error';
import CUSTOMEROPSFORMSUCCESS from '@salesforce/label/c.Customer_Ops_Form_Success';
import PROVIDEFILES from '@salesforce/label/c.Provide_Files';
import plannerContactInfo from '@salesforce/label/c.Planner_Contact_Info';
import loadsPreScheduled from '@salesforce/label/c.Loads_Prescheduled';
import headerTextLabel from '@salesforce/label/c.Customer_Ops_Form_Header';

const MAX_FILE_SIZE = 100000000; //10mb

export default class CustomerInformationForm extends LightningElement {
  @api recordId;
  @api showBillingInfo;
  label = {
    CUSTOMEROPSFORMERROR,
    footerTextLabel,
    CUSTOMEROPSFORMSUCCESS,
    PROVIDEFILES,
    headerTextLabel,
    plannerContactInfo,
    loadsPreScheduled
  }
  isLoaded = false;
  company;
  timezonePicklistValues;
  businessDaysPicklistValues;
  flagIndicatingDataHasBeenLoaded = false;
  showForm;
  hideForm;
  operationalInfoWrapper = {};
  activeSections = ['customerdetails'];
  showTimezone;
  showBusinessDays;
  showStartHour;
  showEndHour;
  showEdiType;
  showHoursOfOperation;
  showPickup;
  showDelivery;
  showSchedulingDetails;
  opeartiondayvalue = [];
  isSubmitted = false;
  isError = false;
  showOTP;
  showOTD;
  showOTPMeasure;
  showOTDMeasure;
  showTrackingFrequency;
  showTenderPrimary;
  showTenderSecondary;
  hideKPISection = false;
  hideAccessorialSection = false;
  acctId;
  acctEDI;
  operationalProgressValue;
  showOnlyBillingInfo = false;
  contactEDIToUpsert = {
    FirstName: '',
    LastName: '',
    Email: '',
    Title: '',
    AccountId: ''
  };
  operationalInfoToUpdate = {
    Id: '',
    Tendering_process_picklist__c: '',
    EDI_Types__c: '',
    Pick_Up_Appointment_Process_picklist__c: '',
    Drop_Off_Appointment_Process_Picklist__c: '',
    OTP_standard__c: '',
    OTD_standard__c: '',
    OTP_is_measure_to__c: '',
    OTD_is_measure_to__c: '',
    Tracking_Frequency_SOTC__c: '',
    Tender_Acceptance_Primary__c: '',
    Tender_Acceptance_Secondary__c: '',
    Approval_Required_Before_Invoicing__c: '',
    Documentation_Required_to_invoice_Pick__c: '',
    Uber_Policy_pick__c: '',
    Detention_Begins_After__c: '',
    Detention_Begins_After_Unit__c: '',
    Detention_Amount__c: '',
    Detention_Billing_Increments_Number__c: '',
    Detention_Billing_Increments_Unit__c: '',
    Detention_time_is_rounded__c: '',
    Max_Detention__c: '',
    Minimum_Billable_Time__c: '',
    Minimum_Billable_Time_unit__c: '',
    Detention_Notification_Required__c: '',
    How_is_detention_requested__c: '',
    Source_of_truth_for_in_out_times_mpk__c: '',
    Time_limit_to_request_detention__c: '',
    Time_limit_to_request_detention_unit__c: '',
    Cancellation_TONU_currency__c: '',
    Layover_currency__c: '',
    Award_All_in_or_fuel_broken_out__c: '',
    Spot_All_in_or_fuel_broken_out__c: '',
    When_is_fuel_surcharge_calculated__c: '',
    DOE_National_or_Regional__c: '',
    Mileage_Provider__c: '',
    Mileage_Provider_Other__c: '',
    Days_of_week_applied_to__c: '',
    Operations_Timezone__c: '',
    Business_Days__c: '',
    Starting_hour_of_operation__c: '',
    Ending_hour_of_operation__c: '',
    Scorecard_Available__c: '',
    Email_For_Billing_Process__c: ''
  }

  tmsDetailsTOInsert = {
    Username__c : '',
    Password__c: '',
    TMS__c: '',
    TMS_other__c: '',
    URL__c: '',
    Account__c: '',
    Active__c: ''
  }
  accountToUpdate = {
    Id:'',
    Is_EDI_Required__c: '',
    AP_Contact_Email__c: '',
    AP_Contact_First_Name__c: '',
    AP_Contact_Name__c: '',
    Billing_Method__c: '',
    Billing_Email_Address__c: ''
  }
  @track listOfContacts;
  contactDetentionToUpsert = {
    FirstName: '',
    LastName: '',
    Email: '',
    Title: '',
    AccountId: ''
  };
  errorFields;
  fileNames = '';
  filesUploaded = [];

  get pickupDeliveryOptions() {
    return [
      { label: 'FCFS', value: 'FCFS' },
      { label: 'Prescheduled', value: 'Pre-Scheduled' },
      { label: 'Shipper to schedule at a later time', value: 'Customer to schedule later' },
      { label: 'Uber Freight to schedule', value: 'UF to schedule' },
      { label: 'Mixed', value: 'Mixture of appointment types' }
    ];
  }

  connectedCallback() {
    this.isLoaded = true;
    if (!checkNullOrEmptyValues(this.showBillingInfo))
      this.showOnlyBillingInfo = true;
    getCustomerOnboardingInfo({recordId: this.recordId})
      .then(result => {
        this.operationalInfoWrapper = result;
        this.error = undefined;
        //Get Dynamic/Dependent Field Values To Render HTML
        if(!checkNullOrEmptyValues(this.operationalInfoWrapper)) {
          if (!checkNullOrEmptyValues(this.operationalInfoWrapper[0].showHideDynamicFields.Operations_Timezone__c)) {
            this.showTimezone = this.operationalInfoWrapper[0].showHideDynamicFields.Operations_Timezone__c;
          }
          if (!checkNullOrEmptyValues(this.operationalInfoWrapper[0].showHideDynamicFields.Business_Days__c)) {
            this.showBusinessDays = this.operationalInfoWrapper[0].showHideDynamicFields.Business_Days__c;
          }
        }

        //Render hours of operation
        if (this.showStartHour === false && this.showEndHour === false) {
          this.showHoursOfOperation = false;
        } else if (this.showStartHour === true || this.showEndHour === true) {
          this.showHoursOfOperation = true;
        }
        //Render scheduling details
        if (this.showPickup === false && this.showDelivery === false) {
          this.showSchedulingDetails = false;
        } else if (this.showPickup === true || this.showDelivery === true) {
          this.showSchedulingDetails = true;
        }
        //Render KPI Section
        if (this.showOTP === false && this.showOTD === false && this.showOTPMeasure === false && this.showOTDMeasure === false && this.showTrackingFrequency === false && this.showTenderPrimary === false && this.showTenderSecondary === false) {
          this.hideKPISection = true;
        }
        this.flagIndicatingDataHasBeenLoaded = true;
        this.isLoaded = false;
      }).catch(error => {
      this.isLoaded = false;
      this.error = error;
      this.isError = true;
      this.operationalInfoWrapper = undefined;
      console.log('Error while fetching dynamic and dependent fields', JSON.stringify(this.error));
      });
  }

  //Get Object Info
  @wire(getObjectInfo, { objectApiName: customerOnboarding })
  objectInfo;

  // Get PickList Values for fields
  @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: timeZone})
  timezonePickVal({ data, error }) {
    if (data) {
      this.timezonePicklistValues = data.values;
    }
  }
  @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: businessDays})
  businessDaysPickVal({ data, error }) {
    if (data) {
      this.businessDaysPicklistValues = data.values;
    }
  }

  @wire(getRecord, { recordId: "$recordId", fields: [ACCOUNTNAME,COMPANY,EDIREQUIRED,OPERATIONALPROGRESS]})
  wiredRecord({ error, data }) {
    if (data) {
      this.company = getFieldValue(data, COMPANY);
      this.acctId = getFieldValue(data, ACCOUNTNAME);
      this.acctEDI = getFieldValue(data, EDIREQUIRED);
      this.operationalProgressValue = getFieldValue(data, OPERATIONALPROGRESS);
      if (this.operationalProgressValue !== 'Go Live' && this.operationalProgressValue !== 'Form Completed') {
        this.showForm = true;
      }
      else {
        this.hideForm = true;
      }
        this.accountToUpdate.Id = this.acctId;
        this.contactEDIToUpsert.AccountId = this.acctId;
        this.contactDetentionToUpsert.AccountId = this.acctId;
        let listOfContacts = [];
        this.createRow(listOfContacts);
        this.listOfContacts = listOfContacts;
    }
    else if (error) {
      this.error = error;
      this.isError = true;
      console.log('Error while fetching:', this.error);
    }
  }

  createRow(listOfContacts) {
    let contactObject = {};
    if(listOfContacts.length > 0) {
      contactObject.index = listOfContacts[listOfContacts.length - 1].index + 1;
    } else {
      contactObject.index = 1;
    }
    contactObject.FirstName = null;
    contactObject.LastName = null;
    contactObject.Email = null;
    contactObject.Title = null;
    contactObject.AccountId = this.acctId;
    contactObject.Freight_Role__c = 'Shipper';
    listOfContacts.push(contactObject);
  }

  addNewRow() {
    this.createRow(this.listOfContacts);
  }

  handleInputChange(event) {
    let index = event.target.dataset.id;
    let fieldName = event.target.name;
    let value = event.target.value;
    for(let i = 0; i < this.listOfContacts.length; i++) {
      if(this.listOfContacts[i].index === parseInt(index)) {
          this.listOfContacts[i][fieldName] = value;
      }
    }
  }

  //Handle Accordion Section
  handleToggleSection(event) {
    this.activeSections = event.detail.openSections;
  }

  handleChange(event) {
    var labelName = event.target.dataset.recordId;
    switch (labelName) {
      case "timezone":
        if (!checkNullOrEmptyValues(event.detail.value))
          this.operationalInfoToUpdate.Operations_Timezone__c = event.detail.value;
        break;
      case "operation":
        if (!checkNullOrEmptyValues(event.detail.value)) {
          this.opeartiondayvalue = event.detail.value.toString();
          this.operationalInfoToUpdate.Business_Days__c = this.opeartiondayvalue.toString().replaceAll(",", ";");
        }
        break;
      case "starthour":
        if (!checkNullOrEmptyValues(event.target.value))
          this.operationalInfoToUpdate.Starting_hour_of_operation__c = event.target.value;
        break;
      case "endhour":
        if (!checkNullOrEmptyValues(event.target.value))
          this.operationalInfoToUpdate.Ending_hour_of_operation__c = event.target.value;
        break;
      case "pickup":
        if (!checkNullOrEmptyValues(event.detail.value))
          this.operationalInfoToUpdate.Pick_Up_Appointment_Process_picklist__c = event.detail.value;
      break;
      case "delivery":
        if (!checkNullOrEmptyValues(event.detail.value))
          this.operationalInfoToUpdate.Drop_Off_Appointment_Process_Picklist__c = event.detail.value;
        break;
    }
  }
  //Event fired from Tendering Details Component
  handleTenderingEvent(event) {
    if (event.detail.fieldApiName === 'EDI_Types__c') {
      this.operationalInfoToUpdate[event.detail.fieldApiName] = event.detail.fieldValue.toString().replaceAll(",", ";");
    }
    else if (this.tmsDetailsTOInsert[event.detail.fieldApiName] !== undefined) {
      this.tmsDetailsTOInsert[event.detail.fieldApiName] = event.detail.fieldValue;
      if (event.detail.fieldValue === TMSLabel) {
        this.operationalInfoToUpdate[Tendering_process_picklist__c] = 'Email';
      }
    }
    else if (this.accountToUpdate[event.detail.fieldApiName] !== undefined) {
      this.accountToUpdate[event.detail.fieldApiName] = event.detail.fieldValue;
    }
    else if (this.contactEDIToUpsert[event.detail.fieldApiName] !== undefined) {
      this.contactEDIToUpsert[event.detail.fieldApiName] = event.detail.fieldValue;
    }
  }
  //Event fired from Billing Details Component
  handleBillingEvent(event) {
    if (this.operationalInfoToUpdate[event.detail.fieldApiName] !== undefined) {
      this.operationalInfoToUpdate[event.detail.fieldApiName] = event.detail.fieldValue;
      if (event.detail.fieldApiName === EmailForBillingLabel) {
        if (event.detail.fieldValue === 'No') {
          this.hideAccessorialSection = true;
        } else {
          this.hideAccessorialSection = false;
        }
      }
    }else if (this.accountToUpdate[event.detail.fieldApiName] !== undefined) {
      this.accountToUpdate[event.detail.fieldApiName] = event.detail.fieldValue;
    }else if (this.contactDetentionToUpsert[event.detail.fieldApiName] !== undefined) {
      this.contactDetentionToUpsert[event.detail.fieldApiName] = event.detail.fieldValue;
    }
  }
  //Event fired from Accessorials and KPI Component
  handleKPIAccessorialEvent(event) {
    if (event.detail.fieldApiName === 'Source_of_truth_for_in_out_times_mpk__c') {
      this.operationalInfoToUpdate[event.detail.fieldApiName] = event.detail.fieldValue.toString().replaceAll(",", ";");
    }
    else if (this.operationalInfoToUpdate[event.detail.fieldApiName] !== undefined) {
      this.operationalInfoToUpdate[event.detail.fieldApiName] = event.detail.fieldValue;
    }
  }

  onFileUpload(event) {
    let files = event.target.files;
    if (files.length > 0) {
      let filesName = '';
      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        filesName = filesName + file.name + ',';
        let freader = new FileReader();
        freader.onload = f => {
          let base64 = 'base64,';
          let content = freader.result.indexOf(base64) + base64.length;
          let fileContents = freader.result.substring(content);
          this.filesUploaded.push({
            Title: file.name,
            VersionData: fileContents
          });
        };
        freader.readAsDataURL(file);
      }
    this.fileNames = filesName.slice(0, -1);
    }
  }

  submitDetails() {
    this.isLoaded = true;
    this.errorFields = this.validateData();
    if (!checkNullOrEmptyValues(this.errorFields)) {
      this.template.querySelector('c-custom-toast').showToast('error', this.errorFields);
      this.isLoaded = false;
    }
    else {
      this.operationalInfoToUpdate.Id = this.recordId;
      if (!checkNullOrEmptyValues(this.tmsDetailsTOInsert.TMS__c)) {
        this.tmsDetailsTOInsert.Account__c = this.acctId;
      } else {
        this.tmsDetailsTOInsert.Active__c = true;
      }
      //Remove the dynamic fields which are already having data from being updated
      for (let i = 0; i < this.operationalInfoWrapper[0].removeDynamicFields.length;i++) {
        delete this.operationalInfoToUpdate[this.operationalInfoWrapper[0].removeDynamicFields[i]];
      }
      //Remove the static fields from being updated, if no value entered in the form
      if (!checkNullOrEmptyValues(this.acctEDI)) {
        delete this.accountToUpdate["Is_EDI_Required__c"];
      }
      Object.keys(this.accountToUpdate).forEach(key => {let value = this.accountToUpdate[key];
        if (checkNullOrEmptyValues(this.accountToUpdate[key])) {
          delete this.accountToUpdate[key];
        }
      });
      if (checkNullOrEmptyValues(this.operationalInfoToUpdate.Approval_Required_Before_Invoicing__c)) {
        delete this.operationalInfoToUpdate["Approval_Required_Before_Invoicing__c"];
      }
      if (checkNullOrEmptyValues(this.operationalInfoToUpdate.Documentation_Required_to_invoice_Pick__c)) {
        delete this.operationalInfoToUpdate["Documentation_Required_to_invoice_Pick__c"];
      }
      for(let i = 0; i < this.listOfContacts.length; i++) {
        delete this.listOfContacts[i].index;
      }
      let button = this.template.querySelector('button');
      button.disabled = true;
      upsertCustomerOperationalInfo({
        contactInfo: JSON.parse(JSON.stringify(this.listOfContacts)),
        operationalInfoToUpdate: this.operationalInfoToUpdate,
        tmsDetailsTOInsert: this.tmsDetailsTOInsert,
        accountToUpdate: this.accountToUpdate,
        contactEDIToUpsert: this.contactEDIToUpsert,
        contactDetentionToUpsert: this.contactDetentionToUpsert,
        filesToInsert: this.filesUploaded
      }).then(data => {
          this.isLoaded = false;
          if (data) {
            this.isSubmitted = true;
            this.isError = false;
          }
        }).catch(error => {
          this.isLoaded = false;
          this.isSubmitted = true;
          this.isError = true;
          this.error = error;
          console.log('Error While upserting form data', JSON.stringify(this.error));
      });
    }
  }
  //check all data validations
  validateData() {
    var errorMsg = '';
    var emailMissing = '';
    var LastnameMissing = '';
    if ((!checkNullOrEmptyValues(this.contactDetentionToUpsert.FirstName) || !checkNullOrEmptyValues(this.contactDetentionToUpsert.LastName)) && checkNullOrEmptyValues(this.contactDetentionToUpsert.Email)) {
      errorMsg += ' Please Fill Request To Detention Email under Accessorials Section,';
    }
    else if ((!checkNullOrEmptyValues(this.contactDetentionToUpsert.FirstName) || !checkNullOrEmptyValues(this.contactDetentionToUpsert.Email)) && checkNullOrEmptyValues(this.contactDetentionToUpsert.LastName)) {
      errorMsg += ' Please Fill Request To Detention Last Name under Accessorials Section,';
    }
    else if ((!checkNullOrEmptyValues(this.contactEDIToUpsert.FirstName) || !checkNullOrEmptyValues(this.contactEDIToUpsert.LastName)) && checkNullOrEmptyValues(this.contactEDIToUpsert.Email)) {
      errorMsg += ' Please Fill EDI Contact Email under Tendering Details Section,';
    }
    else if ((!checkNullOrEmptyValues(this.contactEDIToUpsert.FirstName) || !checkNullOrEmptyValues(this.contactEDIToUpsert.Email)) && checkNullOrEmptyValues(this.contactEDIToUpsert.LastName)) {
      errorMsg += ' Please Fill EDI Contact Last Name under Tendering Details Section,';
    }
    else {
      for (let i = 0; i < this.listOfContacts.length; i++) {
        if (!checkNullOrEmptyValues(this.listOfContacts[i].FirstName) && !checkNullOrEmptyValues(this.listOfContacts[i].LastName) && checkNullOrEmptyValues(this.listOfContacts[i].Email)) {
          emailMissing = true;
        }
        else if ((!checkNullOrEmptyValues(this.listOfContacts[i].FirstName) || !checkNullOrEmptyValues(this.listOfContacts[i].Email)) && checkNullOrEmptyValues(this.listOfContacts[i].LastName)) {
          LastnameMissing = true;
        }
      }
      if (emailMissing === true) {
        errorMsg+= ' Please Fill Teams Contact Email Information Under Customer Details,';
      }
      else if (LastnameMissing === true) {
        errorMsg+= ' Please Fill Teams Contact Last Name Information Under Customer Details,';
      }
    }
    return errorMsg;
  }
}
