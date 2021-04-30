
import React from 'react';
import styles from './styles.module.css';
import { connect } from "react-redux";
import Collapsible from 'react-collapsible';
import DataTable from 'react-data-table-component';
import Utils from '../../utils';

const mapStateToProps = state => {
    return {
        players: state.stats.players,
    }
};

const mapDispatchToProps = dispatch => ({
});

const columns = [
  {
    name: 'Name',
    selector: 'name',
    sortable: true
  },
  {
    name: 'Wins',
    selector: 'score',
    sortable: true,
    right: true,
    sortFunction: (rowA, rowB) => Utils.sortFunction(rowA, rowB, 'score')
  }
];

class Scores extends React.Component {
  constructor(props){
    super(props);
    this.state = {};
  }

  toggleState(field){
    var newState = {};
    newState[field] = !this.state[field];
    this.setState(newState);
  }

  render() {
    return (
      <>
      { this.props.players ?
      <div className={styles.scoresContainer}>
        <div className={styles.scoresTitle} onClick={() => this.toggleState("optionsOpen")}>
          View Scores
        </div>
        <div className={styles.scoresTable}>
          <Collapsible easing="ease-in-out" open={this.state.optionsOpen} >
            {this.props.players ? <DataTable
              theme="dark"
              noHeader={true}
              noTableHead={true}
              columns={columns}
              dense={true}
              data={this.props.players.filter(p => !p.orb && p.type !== "flag")}
            /> : null}
          </Collapsible>
        </div>
      </div> : <></> }
      </>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Scores);