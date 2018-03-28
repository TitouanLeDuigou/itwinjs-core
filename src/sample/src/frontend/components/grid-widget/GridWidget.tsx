import * as React from "react";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { InstanceKey, KeySet } from "@bentley/ecpresentation-common";
import { ECPresentation, SelectionChangeEventArgs, ISelectionProvider, SelectionHandler } from "@bentley/ecpresentation-frontend";
import { GridDataProvider } from "@bentley/ecpresentation-controls";
import "./GridWidget.css";

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

export default class GridWidget extends React.Component<Props> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {};
  }
  public render() {
    return (
      <div className="GridWidget">
        <h3>Grid</h3>
        <div className="ContentContainer">
          <Grid imodelToken={this.props.imodel.iModelToken} rulesetId={this.props.rulesetId} />
        </div>
      </div>
    );
  }
}

interface GridProps {
  imodelToken: IModelToken;
  rulesetId: string;
}
interface ColumnDefinition {
  name: string;
  label: string;
}
interface RowDefinition {
  values: { [key: string]: string };
  selected: boolean;
  instanceKey: InstanceKey;
}
interface GridState {
  columns?: ColumnDefinition[];
  rows?: RowDefinition[];
  error?: string;
}
const initialState: GridState = {
  columns: [],
  rows: [],
  error: undefined,
};
class Grid extends React.Component<GridProps, GridState> {
  private _dataProvider: GridDataProvider;
  private _selectionHandler: SelectionHandler;
  private _hasSelection: boolean;

  constructor(props: GridProps, context?: any) {
    super(props, context);
    this.state = initialState;
    this._hasSelection = false;
    this._dataProvider = new GridDataProvider(props.imodelToken, props.rulesetId);
    this._selectionHandler = new SelectionHandler(ECPresentation.selection, "Grid", props.imodelToken, props.rulesetId, this.onSelectionChanged);
  }

  // tslint:disable-next-line:naming-convention
  private onSelectionChanged = (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider): void => {
    if (evt.level !== 0)
      return;
    const selectedItems = selectionProvider.getSelection(this.props.imodelToken, 0);
    this._hasSelection = !selectedItems.isEmpty;
    this.fetchData(this.props.imodelToken, selectedItems);
  }

  public componentWillReceiveProps(newProps: GridProps) {
    if (newProps.rulesetId !== this.props.rulesetId || newProps.imodelToken !== this.props.imodelToken) {
      this._selectionHandler.rulesetId = newProps.rulesetId;
      this._selectionHandler.imodelToken = newProps.imodelToken;
      this._dataProvider = new GridDataProvider(newProps.imodelToken, newProps.rulesetId);
    }
  }

  public componentWillUnmount() {
    this._selectionHandler.dispose();
  }

  private createCellDisplayValue(value: any): string {
    if (!value)
      return "";
    if (typeof (value) === "string")
      return value;
    if (typeof (value) === "object" || Array.isArray(value))
      return JSON.stringify(value);
    return value.toString();
  }

  private async fetchData(_imodelToken: IModelToken, selection: Readonly<KeySet>) {
    this.setState(initialState);

    if (selection.isEmpty || !this._dataProvider)
      return;

    try {
      this._dataProvider.keys = selection;
      const columns = new Array<ColumnDefinition>();
      const columnDescriptions = await this._dataProvider.getColumns();
      for (const columnDescription of columnDescriptions)
        columns.push({ name: columnDescription.key, label: columnDescription.label });
      this.setState({ ...initialState, columns });

      const rowsCount = await this._dataProvider.getRowsCount();
      const rows = new Array<RowDefinition>();
      for (let i = 0; i < rowsCount; ++i) {
        const row = await this._dataProvider.getRow(i);
        const values: { [key: string]: string } = {};
        for (const cell of row.cells)
          values[cell.key] = this.createCellDisplayValue(cell.displayValue);
        rows.push({ values, selected: false, instanceKey: row.key });
      }
      this.setState({ ...initialState, columns, rows });

    } catch (error) {
      this.setState({ ...initialState, error: error.toString() });
    }
  }
  private renderHeaderRow() {
    return (
      <tr>
        {this.state.columns!.map((col) => (
          <th key={col.name}>{col.label}</th>
        ))}
      </tr>);
  }
  private renderCell(key: string, values: { [key: string]: string }) {
    try {
      return (<td key={key}>{values[key]}</td>);
    } catch (e) {
      return (<td key={key} className="Error">{e.toString()}</td>);
    }
  }
  private renderRow(row: RowDefinition, index: number) {
    return (
      <tr key={index} data-selected={row.selected} onClick={() => this._handleClick(index, row.instanceKey)}>
        {this.state.columns!.map((col) => this.renderCell(col.name, row.values))}
      </tr>);
  }
  private renderNoRecords(columnCount: number) {
    return (<tr><td className="NoData" colSpan={columnCount}>No records</td></tr>);
  }

  private _handleClick = (index: number, key: InstanceKey): void => {
    if (this.state.rows) {
      const row = this.state.rows[index];

      if (row.selected)
        this._selectionHandler.removeFromSelection([key], 1);
      else
        this._selectionHandler.addToSelection([key], 1);

      row.selected = !row.selected;
      this.forceUpdate();
    }
  }

  public render() {
    if (this.state.error)
      return (<div className="Error">{this.state.error}</div>);
    if (!this._hasSelection)
      return (<div className="NoData">Nothing selected</div>);
    if (!this.state.columns || 0 === this.state.columns.length)
      return (<div className="NoData">No data</div>);
    return (
      <table>
        <thead>
          {this.renderHeaderRow()}
        </thead>
        <tbody>
          {this.state.rows ? this.state.rows.map((row, index) => this.renderRow(row, index)) : this.renderNoRecords(this.state.columns.length)}
        </tbody>
      </table>
    );
  }
}
