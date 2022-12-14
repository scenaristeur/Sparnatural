import { Pattern } from "sparqljs";
import { getSettings } from "../../../../sparnatural/settings/defaultSettings";
import AddUserInputBtn from "../../buttons/AddUserInputBtn";
import InfoBtn from "../../buttons/InfoBtn";
import WidgetWrapper from "../../builder-section/groupwrapper/criteriagroup/edit-components/WidgetWrapper";
import { AbstractWidget, ValueRepetition, WidgetValue } from "../AbstractWidget";
import "@chenfengyuan/datepicker";
import * as DataFactory from "@rdfjs/data-model" ;
import { SelectedVal } from "../../../generators/ISparJson";
import ISpecProvider from "../../../spec-providers/ISpecProvider";
import SparqlFactory from "../../../generators/SparqlFactory";
import { buildDateRangeOrExactDatePattern } from "./TimeDatePattern";

export class DateTimePickerValue implements WidgetValue {
  value: {
    label: string;
    start: Date;
    stop: Date;
  };

  key():string {
    return JSON.stringify(this.value.start).replace(/["]+/g,'')+" - "+JSON.stringify(this.value.stop).replace(/["]+/g,'');
  }

  constructor(v:DateTimePickerValue["value"]) {
    this.value = v;
  }

}

// converts props of type Date to type string
type StringifyDate<T> = T extends Date
  ? string
  : T extends object
  ? {
      [k in keyof T]: StringifyDate<T[k]>;
    }
  : T;

// stringified type of DateTimePickerValue
// see: https://effectivetypescript.com/2020/04/09/jsonify/
type StringDateTimeValue = StringifyDate<DateTimePickerValue>

export class TimeDatePickerWidget extends AbstractWidget {
 
  protected widgetValues: DateTimePickerValue[];
  datesHandler: any;
  ParentComponent: any;
  dateFormat: any;
  inputStart: JQuery<HTMLElement>;
  inputEnd: JQuery<HTMLElement>;
  inputValue: JQuery<HTMLElement>;
  infoBtn: InfoBtn;
  addValueBtn: AddUserInputBtn;
  value: DateTimePickerValue;
  startClassVal: SelectedVal;
  objectPropVal: SelectedVal;
  endClassVal: SelectedVal;
  specProvider: ISpecProvider;

  constructor(
    parentComponent: WidgetWrapper,
    datesHandler: any,
    dateFormat: any,
    startClassCal: SelectedVal,
    objectPropVal: SelectedVal,
    endClassVal: SelectedVal,
    specProvider: ISpecProvider
  ) {
    super(
      "timedatepicker-widget",
      parentComponent,
      null,
      startClassCal,
      objectPropVal,
      endClassVal,
      ValueRepetition.SINGLE
    );
    this.datesHandler = datesHandler;
    this.dateFormat = dateFormat;
    this.specProvider = specProvider;
  }

  render() {
    super.render();
    this.html.append(
      $(`<span>${getSettings().langSearch.LabelDateFrom}&nbsp;</span>`)
    );
    this.inputStart = $(
      `<input id="input-start" placeholder="${
        getSettings().langSearch.TimeWidgetDateFrom
      }" autocomplete="off" class="${this.dateFormat}" />`
    );
    this.inputEnd = $(
      `<input id="input-end" placeholder="${
        getSettings().langSearch.TimeWidgetDateTo
      }" autocomplete="off" class="${this.dateFormat}" />`
    );
    this.inputValue = $(`<input id="input-value" type="hidden"/>`);
    let span = $(`<span>&nbsp;${getSettings().langSearch.LabelDateTo}&nbsp;</span>`);
    this.html
      .append(this.inputStart)
      .append(span)
      .append(this.inputEnd)
      .append(this.inputValue);
    // Build datatippy info
    let datatippy =
      this.dateFormat == "day"
        ? getSettings().langSearch.TimeWidgetDateHelp
        : getSettings().langSearch.TimeWidgetYearHelp;
    // set a tooltip on the info circle
    var tippySettings = Object.assign({}, getSettings().tooltipConfig);
    tippySettings.placement = "left";
    tippySettings.trigger = "click";
    tippySettings.offset = [this.dateFormat == "day" ? 75 : 50, -20];
    tippySettings.delay = [0, 0];
    this.infoBtn = new InfoBtn(this, datatippy, tippySettings).render();
    //finish datatippy

    this.addValueBtn = new AddUserInputBtn(
      this,
      getSettings().langSearch.ButtonAdd,
      this.#addValueBtnClicked
    ).render();

    let calendarFormat = 
    (this.dateFormat == "day")
    ? getSettings().langSearch.PlaceholderTimeDateDayFormat
    : getSettings().langSearch.PlaceholderTimeDateFormat;

    var options: {
      language: any;
      autoHide: boolean;
      format: any;
      date: any;
      startView: number;
    } = {
      language: getSettings().langSearch.LangCodeTimeDate,
      autoHide: true,
      format: calendarFormat,
      date: null,
      startView: 2,
    };

    this.inputStart.datepicker(options);
    this.inputEnd.datepicker(options);

    return this;
  }

  /**
   * We are blocking the generation of the predicate between start and end class
   * if the property is configured with a begin and end date (because the triples will then be generated by this class)
   * @returns true if the property has been configured with a begin and an end date property
   */
  isBlockingObjectProp() {
    let beginDateProp = this.specProvider.getBeginDateProperty(this.objectPropVal.type);
    let endDateProp = this.specProvider.getEndDateProperty(this.objectPropVal.type);

    return (beginDateProp != null && endDateProp != null);
  }

  #addValueBtnClicked = () => {

    // fix for negative years
    // set a minus in front of the date if there was one in the value
    let startDate:Date;
    if(this.inputStart.val() != '') {
      startDate = this.inputStart.datepicker("getDate");
      if((this.inputStart.val() as string).startsWith("-") && !startDate.toISOString().startsWith("-")) {
        startDate.setFullYear(parseInt(this.inputStart.val().toString()));
      }
    }
    
    let endDate:Date;
    if(this.inputEnd.val() != '') {
      endDate = this.inputEnd.datepicker("getDate");
      if((this.inputEnd.val() as string).startsWith("-") && !endDate.toISOString().startsWith("-")) {
        endDate.setFullYear(parseInt(this.inputEnd.val().toString()));
      }
    }

    let stringDateTimeVal:StringDateTimeValue["value"] ={
      label: null,
      start:(startDate)?startDate.toISOString():null,
      stop:(endDate)?endDate.toISOString():null,
    } 
    let widgetVal: DateTimePickerValue = this.parseInput(
      stringDateTimeVal
    );
    if (!widgetVal) return;
    this.renderWidgetVal(widgetVal);
  };

  parseInput(input: StringDateTimeValue["value"]): DateTimePickerValue {
    if(!this.#isValidDate(input.start) && !this.#isValidDate(input.stop)) throw Error('No valid Date received')
    let startValue = (this.#isValidDate(input.start))?new Date(input.start):null
    let endValue = (this.#isValidDate(input.stop))?new Date(input.stop):null
    if (startValue && endValue && (startValue > endValue)) throw Error('StartDate is bigger than Enddate!')

    let tmpValue: { start: Date; stop: Date; startLabel: string; endLabel: string };

    if (this.dateFormat == "day") {
      tmpValue = {
        start: (startValue)?new Date(startValue.setHours(0, 0, 0, 0)):null,
        stop: (endValue)?new Date(endValue.setHours(23, 59, 59, 59)):null,
        startLabel: startValue?startValue.toLocaleDateString():"",
        endLabel: endValue?endValue.toLocaleDateString():""
      };
    } else {
      tmpValue = {
        start: this.#getFirstDayYear(startValue), 
        stop: this.#getLastDayOfYear(endValue),
        startLabel: startValue?startValue.getFullYear().toString():"",
        endLabel: endValue?endValue.getFullYear().toString():""
      };
    }
    let dateTimePickerVal = new DateTimePickerValue({
        label: this.#getValueLabel(tmpValue.startLabel, tmpValue.endLabel),
        start: tmpValue.start,
        stop: tmpValue.stop,
      });
    return dateTimePickerVal;
  }
  #getFirstDayYear(startValue:Date) {
    return startValue ?
    new Date(startValue.getFullYear(),0,1,0,0,1,0) 
    :null
  }
  #getLastDayOfYear(endValue:Date) {
    return endValue ? 
    new Date(endValue.getFullYear(),11,31,23,59,59) 
    :null
  }

  getRdfJsPattern(): Pattern[] {
    let beginDateProp = this.specProvider.getBeginDateProperty(this.objectPropVal.type);
    let endDateProp = this.specProvider.getEndDateProperty(this.objectPropVal.type);

    if(beginDateProp != null && endDateProp != null) {
      let exactDateProp = this.specProvider.getExactDateProperty(this.objectPropVal.type);

      return [
        buildDateRangeOrExactDatePattern(
          this.widgetValues[0].value.start?DataFactory.literal(
            this.#formatSparqlDate(this.widgetValues[0].value.start),
            DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#dateTime")
          ):null,
          this.widgetValues[0].value.stop?DataFactory.literal(
            this.#formatSparqlDate(this.widgetValues[0].value.stop),
            DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#dateTime")
          ):null,
          DataFactory.variable(
            this.getVariableValue(this.startClassVal)
          ),
          DataFactory.namedNode(beginDateProp),
          DataFactory.namedNode(endDateProp),
          exactDateProp != null?DataFactory.namedNode(exactDateProp):null,
          DataFactory.variable(this.getVariableValue(this.startClassVal))
        ),
      ];
    } else {
      return [
        SparqlFactory.buildFilterTime(
          this.widgetValues[0].value.start?DataFactory.literal(
            this.#formatSparqlDate(this.widgetValues[0].value.start),
            DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#dateTime")
          ):null,
          this.widgetValues[0].value.stop?DataFactory.literal(
            this.#formatSparqlDate(this.widgetValues[0].value.stop),
            DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#dateTime")
          ):null,
          DataFactory.variable(
            this.getVariableValue(this.endClassVal)
          )
        ),
      ];
    }    
  }

  /**
   * 
   * @param date Formats the date to insert in the SPARQL query. We cannot rely on toISOString() method
   * since it does not properly handle negative year and generates "-000600-12-31" while we want "-0600-12-31"
   * @returns 
   */
  #formatSparqlDate(date:Date) {
    if(date == null) return null;

    return this.#padYear(date.getUTCFullYear()) +
    '-' + this.#pad(date.getUTCMonth() + 1) +
    '-' + this.#pad(date.getUTCDate()) +
    'T' + this.#pad(date.getUTCHours()) +
    ':' + this.#pad(date.getUTCMinutes()) +
    ':' + this.#pad(date.getUTCSeconds()) +
    'Z';
  }

  #pad(number:number) {
    if (number < 10) {
      return '0' + number;
    }
    return number;
  }

  #padYear(number:number) {
    let absoluteValue = (number < 0)?-number:number;
    let absoluteString = (absoluteValue < 1000)?absoluteValue.toString().padStart(4,'0'):absoluteValue.toString();
    let finalString = (number < 0)?"-"+absoluteString:absoluteString;
    return finalString;
  }

  #getValueLabel = function (startLabel: string, stopLabel: string) {
    let valueLabel = "";
    if ((startLabel != "") && (stopLabel != "")) {
      valueLabel = getSettings().langSearch.LabelDateFrom+' '+ startLabel +' '+getSettings().langSearch.LabelDateTo+' '+ stopLabel ;
    } else if (startLabel != "") {
      valueLabel = getSettings().langSearch.DisplayValueDateFrom+' '+ startLabel ;
    } else if (stopLabel != "") {
      valueLabel = getSettings().langSearch.DisplayValueDateTo+' '+ stopLabel ;
    }

    return valueLabel;
  };

  #isValidDate(dateString:string){
    return (new Date(dateString).toString() !== "Invalid Date") && !isNaN(Date.parse(dateString));
  }
}