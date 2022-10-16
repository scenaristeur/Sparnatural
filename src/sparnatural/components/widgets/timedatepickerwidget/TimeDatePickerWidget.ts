import { Pattern } from "sparqljs";
import { getSettings } from "../../../../configs/client-configs/settings";
import AddUserInputBtn from "../../buttons/AddUserInputBtn";
import InfoBtn from "../../buttons/InfoBtn";
import WidgetWrapper from "../../builder-section/groupwrapper/criteriagroup/edit-components/WidgetWrapper";
import { AbstractWidget, ValueRepetition, WidgetValue } from "../AbstractWidget";
import "@chenfengyuan/datepicker";
import * as DataFactory from "@rdfjs/data-model" ;
import { SelectedVal } from "../../../generators/ISparJson";
import ISpecProvider from "../../../spec-providers/ISpecProviders";
import SparqlFactory from "../../../generators/SparqlFactory";
import { buildDateRangeOrExactDatePattern } from "./TimeDatePattern";

export interface DateTimePickerValue extends WidgetValue {
  value: {
    key: string;
    label: string;
    start: Date;
    stop: Date;
  };
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
    let stringDateTimeVal:StringDateTimeValue ={
      value: {
        key: null,
        label: null,
        start:(this.inputStart.val() != '')?this.inputStart.datepicker("getDate").toISOString():null,
        stop:(this.inputEnd.val() != '')?this.inputEnd.datepicker("getDate").toISOString():null,
      }
    } 
    let widgetVal: DateTimePickerValue = this.parseInput(
      stringDateTimeVal
    );
    if (!widgetVal) return;
    this.renderWidgetVal(widgetVal);
  };

  parseInput(input: StringDateTimeValue): DateTimePickerValue {
    if(!this.#isValidDate(input.value.start) && !this.#isValidDate(input.value.stop)) throw Error('No valid Date received')
    let startValue = (this.#isValidDate(input.value.start))?new Date(input.value.start):null
    let endValue = (this.#isValidDate(input.value.stop))?new Date(input.value.stop):null
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
    let dateTimePickerVal: DateTimePickerValue = {
      value: {
        // here : we get the JSON representation of the date, as a lazy way to format date
        key: JSON.stringify(tmpValue.start).replace(/["]+/g,'')+" - "+JSON.stringify(tmpValue.stop).replace(/["]+/g,''),
        label: this.#getValueLabel(tmpValue.startLabel, tmpValue.endLabel),
        start: tmpValue.start,
        stop: tmpValue.stop,
      },
    };
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
            this.widgetValues[0].value.start.toISOString(),
            DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#dateTime")
          ):null,
          this.widgetValues[0].value.stop?DataFactory.literal(
            this.widgetValues[0].value.stop.toISOString(),
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
            this.widgetValues[0].value.start.toISOString(),
            DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#dateTime")
          ):null,
          this.widgetValues[0].value.stop?DataFactory.literal(
            this.widgetValues[0].value.stop.toISOString(),
            DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#dateTime")
          ):null,
          DataFactory.variable(
            this.getVariableValue(this.endClassVal)
          )
        ),
      ];
    }    
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
