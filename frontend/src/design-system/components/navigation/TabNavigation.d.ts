export interface TabItem {
  id: string;
  label: string;
}

/**
 */
export interface TabNavigationProps {
  tabs: TabItem[];
  activeId: string;
  onChange?: (id: string) => void;
}
