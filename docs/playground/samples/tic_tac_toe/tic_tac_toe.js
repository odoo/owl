// This example is an implementation of the Tic-Tac-Toe game, from
// https://react.dev/learn/tutorial-tic-tac-toe.  This is an easy application to start learning owl
// with some interesting user interactions.
//
// In this implementation, we use the owl reactivity mechanism.
import { Component, useState, mount } from "@odoo/owl";


class Square extends Component {
    static template = "Square";
}

class Board extends Component {
    static template = "Board"
    static components = { Square };

    handleClick(i) {
        if (this.calculateWinner(this.props.squares) || this.props.squares[i]) {
          return;
        }
        const nextSquares = this.props.squares.slice();
        if (this.props.xIsNext) {
          nextSquares[i] = 'X';
        } else {
          nextSquares[i] = 'O';
        }
        this.props.onPlay(nextSquares);
    }

    get status(){
        const winner = this.calculateWinner(this.props.squares);
        if (winner) {
          return 'Winner: ' + winner;
        } else {
            if (Object.values(this.props.squares).filter((v) => v === null).length > 0)
                return 'Next player: ' + (this.props.xIsNext ? 'X' : 'O');
            else 
                return 'Draw';
        }
    }

    calculateWinner(squares) {
        const lines = [
          [0, 1, 2],
          [3, 4, 5],
          [6, 7, 8],
          [0, 3, 6],
          [1, 4, 7],
          [2, 5, 8],
          [0, 4, 8],
          [2, 4, 6],
        ];
        for (let i = 0; i < lines.length; i++) {
          const [a, b, c] = lines[i];
          if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
            return squares[a];
          }
        }
        return null;
      }
}  

class Game extends Component {
    static template = "Game"
    static components = { Board };

    setup() {
        this.state = useState({
            currentMove: 0,
            history: [Array(9).fill(null)],
        });
    }

    get currentSquares() {
        return this.state.history[this.state.currentMove];
    }

    get xIsNext() {
        return this.state.currentMove % 2 === 0;
    }

    jumpTo(nextMove) {
        this.state.currentMove = nextMove;
    }

    handlePlay(nextSquares) {
        const nextHistory = [...this.state.history.slice(0, this.state.currentMove + 1), nextSquares];
        this.state.history = nextHistory;
        this.state.currentMove = this.state.history.length - 1;
    }

    get moves() {
        return this.state.history.map((_squares, move) => {
            if (move > 0) {
              return {id: move, description: 'Go to move #' + move};
            } else {
              return {id: move, description: 'Go to game start'};
            }
        });
    }

}

// Application setup
mount(Game, document.body, { templates: TEMPLATES, dev: true});
