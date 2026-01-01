export namespace main {
	
	export class Transaction {
	    id: number;
	    date: string;
	    category: string;
	    sub_category: string;
	    description: string;
	    amount: number;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new Transaction(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.date = source["date"];
	        this.category = source["category"];
	        this.sub_category = source["sub_category"];
	        this.description = source["description"];
	        this.amount = source["amount"];
	        this.color = source["color"];
	    }
	}

}

