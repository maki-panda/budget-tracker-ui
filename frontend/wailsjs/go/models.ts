export namespace main {
	
	export class Budget {
	    total: number;
	    categories: Record<string, number>;
	    subCategories: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new Budget(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.categories = source["categories"];
	        this.subCategories = source["subCategories"];
	    }
	}
	export class Transaction {
	    id: number;
	    date: string;
	    category: string;
	    sub_category: string;
	    payment: string;
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
	        this.payment = source["payment"];
	        this.description = source["description"];
	        this.amount = source["amount"];
	        this.color = source["color"];
	    }
	}

}

