import * as vscode from 'vscode';
import * as path from "path";
import { TestNode } from './testNode';
import { Commands } from './commands';
import { TestResult } from './testResult';


export class GoTestProvider implements vscode.TreeDataProvider<TestNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<TestNode | undefined> = new vscode.EventEmitter<TestNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TestNode | undefined> = this._onDidChangeTreeData.event;

	private __discoveredTestsMap: Map<string, TestNode>;
	private _discoveredTests: TestNode[];
	private _discovering: boolean;
	constructor(private context: vscode.ExtensionContext, commands: Commands) {
		context.subscriptions.push(commands.discoveredTest(this.onDicoveredTest, this));
		context.subscriptions.push(commands.rediscoveredTest(this.onRediscoveredTest, this));
		context.subscriptions.push(commands.testDiscoveryStarted(this.onDiscoverTestStart, this));
		context.subscriptions.push(commands.testResult(this.updateTestResult, this));
		context.subscriptions.push(commands.testRunStarted(this.onTestRunStarted, this));
	}

	private refresh(testNode?: TestNode): void {
		this._onDidChangeTreeData.fire(testNode);
	}

	getTreeItem(testNode: TestNode): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(testNode.name, testNode.isTestSuite ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);

		treeItem.contextValue = this._discovering ? 'discovering' : testNode.isTestSuite ? 'testSuite' : 'test';

		if (!testNode.isTestSuite) {
			treeItem.command = {
				command: 'goTestExplorer.goToLocation',
				title: testNode.tooltip,
				arguments: [testNode]
			};
		}
		treeItem.iconPath = {
			dark: this.context.asAbsolutePath(path.join("resources", "dark", testNode.icon)),
			light: this.context.asAbsolutePath(path.join("resources", "light", testNode.icon))
		};

		return treeItem;
	}

	getChildren(testNode?: TestNode): Thenable<TestNode[]> {
		if (testNode) {
			return Promise.resolve(testNode.children);
		}
		if (this._discovering) {
			return Promise.resolve(
				[new TestNode("Loading...", null)]);
		}
		return Promise.resolve(this._discoveredTests);
	}
	get discoveredTests(): TestNode[] {
		return this._discoveredTests;
	}
	getDiscoveredTestNode(key: string): TestNode {
		return this.__discoveredTestsMap.get(key);
	}

	private updateTestResult(testResult: TestResult) {

		let testNode = this.__discoveredTestsMap.get(this.getNodeKey(testResult.uri.fsPath, testResult.testName));
		if (testNode) {
			testNode.testResult = testResult;
		}
		this.refresh(testNode);
	}
	private onDiscoverTestStart() {
		this._discoveredTests = [];
		this._discovering = true;
		this.refresh();
	}
	private onDicoveredTest(testNodeList: TestNode[]) {
		this._discoveredTests = testNodeList && testNodeList.length > 0 ? testNodeList : [];

		this.__discoveredTestsMap = new Map();
		this._discoveredTests.forEach(x => {
			if (x.isTestSuite) {
				x.children.forEach(node => {
					this.__discoveredTestsMap.set(this.getNodeKey(node.uri.fsPath, node.name), node);
				});
				this.__discoveredTestsMap.set(x.uri.fsPath, x);
			} else {
				this.__discoveredTestsMap.set(this.getNodeKey(x.uri.fsPath, x.name), x);
			}
		});

		this._discovering = false;
		this.refresh();
	}
	private onRediscoveredTest(nodes: TestNode[]) {
		nodes.forEach(node => {
			const existingTestInd = this._discoveredTests.findIndex(test => node.uri.fsPath === test.uri.fsPath);
			this._discoveredTests[existingTestInd] = node;
			if (node.isTestSuite) {
				node.children.forEach(child => {
					this.__discoveredTestsMap.set(this.getNodeKey(child.uri.fsPath, child.name), child);
				});
				this.__discoveredTestsMap.set(node.uri.fsPath, node);
			} else {
				this.__discoveredTestsMap.set(this.getNodeKey(node.uri.fsPath, node.name), node);
			}
		});
		this.refresh();
	}
	private onTestRunStarted(testNode: TestNode) {
		testNode ? this.setLoading(testNode) : this.setAlloading();
	}
	private setLoading(testNode: TestNode) {
		let tempNode = this.__discoveredTestsMap.get(this.getNodeKey(testNode.uri.fsPath, testNode.name));
		if (tempNode) {
			tempNode.setLoading();
		}
		this.refresh(tempNode);
	}
	private setAlloading() {
		this.discoveredTests.
			filter(s => s.isTestSuite).
			forEach(s => s.children.forEach(t => t.setLoading()));

		this.refresh();
	}
	private getNodeKey(uri: string, nodeName: string): string {
		return uri + "__" + nodeName;
	}
}

