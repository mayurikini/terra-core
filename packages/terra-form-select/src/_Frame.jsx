/**
 * TODO
 *
 * Wire up default variant to shift focus to dropdown
 *
 * Write wdio tests to ensure focus is placed correctly with these additions
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames/bind';
import 'terra-base/lib/baseStyles';
import { KeyCodes, Variants } from './_constants';
import Dropdown from './_Dropdown';
import Util from './_FrameUtil';
import styles from './_Frame.module.scss';

const cx = classNames.bind(styles);

const propTypes = {
  /**
   * Whether the select is disabled.
   */
  disabled: PropTypes.bool,
  /**
   * The select display.
   */
  display: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
  /**
   * A render callback for dropdown content.
   */
  dropdown: PropTypes.func,
  /**
   * Additional attributes to spread onto the dropdown. ( Style, ClassNames, etc.. )
   */
  // eslint-disable-next-line react/forbid-prop-types
  dropdownAttrs: PropTypes.object,
  /**
   * Whether the select is in an invalid state.
   */
  isInvalid: PropTypes.bool,
  /**
   * The max height of the dropdown.
   */
  maxHeight: PropTypes.number,
  /**
   * Content to display when no search results are found.
   */
  noResultContent: PropTypes.node,
  /**
   * Callback function triggered when an option is deselected.
   */
  onDeselect: PropTypes.func,
  /**
   * Callback function triggered when the frame loses focus.
   */
  onBlur: PropTypes.func,
  /**
   * Callback function triggered when the frame gains focus.
   */
  onFocus: PropTypes.func,
  /**
   * Callback function triggered when the search criteria changes.
   */
  onSearch: PropTypes.func,
  /**
   * Callback function triggered when an option is selected.
   */
  onSelect: PropTypes.func,
  /**
   * Callback function for option filtering. function(searchValue, option)
   */
  optionFilter: PropTypes.func,
  /**
   * Placeholder text.
   */
  placeholder: PropTypes.string,
  /**
   * The select value.
   */
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
  /**
   * The behavior of the select.
   */
  variant: PropTypes.oneOf([
    Variants.COMBOBOX,
    Variants.DEFAULT,
    Variants.MULTIPLE,
    Variants.SEARCH,
    Variants.TAG,
  ]),
};

const defaultProps = {
  disabled: false,
  dropdown: undefined,
  dropdownAttrs: undefined,
  isInvalid: false,
  noResultContent: undefined,
  onDeselect: undefined,
  onSearch: undefined,
  onSelect: undefined,
  optionFilter: undefined,
  placeholder: undefined,
  value: undefined,
  variant: Variants.DEFAULT,
};

/* This rule can be removed when eslint-plugin-jsx-a11y is updated to ~> 6.0.0 */
/* eslint-disable jsx-a11y/no-static-element-interactions */
class Frame extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      isFocused: false,
      isInputFocused: false,
      isPositioned: false,
      hasSearchChanged: false,
      searchValue: '',
    };

    this.setInput = this.setInput.bind(this);
    this.getDisplay = this.getDisplay.bind(this);
    this.renderToggleButton = this.renderToggleButton.bind(this);
    this.openDropdown = this.openDropdown.bind(this);
    this.closeDropdown = this.closeDropdown.bind(this);
    this.toggleDropdown = this.toggleDropdown.bind(this);
    this.positionDropdown = this.positionDropdown.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleInputMouseDown = this.handleInputMouseDown.bind(this);
    this.handleInputFocus = this.handleInputFocus.bind(this);
    this.handleInputBlur = this.handleInputBlur.bind(this);
    this.handleButtonClick = this.handleButtonClick.bind(this);
    this.visuallyHiddenComponent = React.createRef();
    this.selectListBox = '#terra-select-dropdown [role="listbox"]';
  }

  componentDidUpdate(previousProps, previousState) {
    if (Util.shouldPositionDropdown(previousState, this.state, this.dropdown)) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(this.positionDropdown, !previousState.isOpen ? 0 : 100);
    }
  }

  componentWillUnmount() {
    clearTimeout(this.debounceTimer);
  }

  setInput(input) {
    this.input = input;
  }

  getDisplay() {
    const { hasSearchChanged, searchValue } = this.state;
    const {
      disabled, display, placeholder, variant,
    } = this.props;

    const inputAttrs = {
      disabled,
      placeholder,
      ref: this.setInput,
      onChange: this.handleSearch,
      onMouseDown: this.handleInputMouseDown,
      'aria-disabled': disabled,
      className: cx('search-input', { 'is-hidden': Util.shouldHideSearch(this.props, this.state) }),
    };

    switch (variant) {
      case Variants.TAG:
      case Variants.MULTIPLE:
        return (
          <ul className={cx('content')}>
            {display}
            <li className={cx('search-wrapper')}>
              <input onFocus={this.handleInputFocus} onBlur={this.handleInputBlur} {...inputAttrs} value={searchValue} />
            </li>
          </ul>
        );
      case Variants.SEARCH:
      case Variants.COMBOBOX:
        return <div className={cx('content')}><input onFocus={this.handleInputFocus} onBlur={this.handleInputBlur} {...inputAttrs} value={hasSearchChanged ? searchValue : display} /></div>;
      default:
        return display || <div className={cx('placeholder')}>{placeholder || '\xa0'}</div>;
    }
  }

  /**
   * Closes the dropdown.
   */
  closeDropdown() {
    this.setState({
      isAbove: false,
      isFocused: document.activeElement === this.input || document.activeElement === this.select,
      isOpen: false,
      isPositioned: false,
      hasSearchChanged: false,
      searchValue: '',
    });

    // Tags and Comboboxes will select the current search value when the component loses focus.
    if (Util.shouldAddOptionOnBlur(this.props, this.state)) {
      this.props.onSelect(this.state.searchValue);
    }
  }

  /**
   * Opens the dropdown.
   */
  openDropdown(event) {
    if (this.state.isOpen || this.props.disabled) {
      return;
    }

    // Avoid focusing the input if the toggle button is used to open the dropdown
    // This is to avoid an issue with VoiceOver on iOS with shifting focus while the onScreen keyboard is open
    if (event && event.target
      && (event.target.hasAttribute('data-terra-form-select-toggle-button')
      || event.target.hasAttribute('data-terra-form-select-toggle-button-icon'))) {
      this.setState({ isOpen: true, isPositioned: false });
      return;
    }

    if (this.input) {
      this.input.focus();
    }

    this.setState({ isOpen: true, isPositioned: false });
  }

  /**
   * Positions the dropdown to utilize the most available space.
   */
  positionDropdown() {
    if (!this.state.isOpen) {
      return;
    }

    const { dropdownAttrs, maxHeight } = this.props;
    const { select, dropdown } = this;
    this.setState(Util.dropdownPosition(dropdownAttrs, select, dropdown, maxHeight));
  }

  /**
   * Handles the blur event.
   */
  handleBlur(event) {
    // The check for dropdown.contains(activeElement) is necessary to prevent IE11 from closing dropdown on click of scrollbar in certain contexts.
    if (this.dropdown && (this.dropdown === document.activeElement && this.dropdown.contains(document.activeElement))) {
      return;
    }

    this.closeDropdown();

    if (this.props.onBlur) {
      this.props.onBlur(event);
    }
  }

  /**
   * Handles the focus event.
   */
  handleFocus(event) {
    if (this.props.disabled) {
      return;
    }

    if (this.props.onFocus && !this.state.isFocused) {
      this.props.onFocus(event);
    }

    if (!this.state.isFocused) {
      this.setState({ isFocused: true });
    }
  }

  /**
   * Manages keyboard interactions and accessibility.
   * @param {event} event - The onKeyDown event.
   */
  handleKeyDown(event) {
    const { value } = this.props;
    const { keyCode, target } = event;
    const {
      BACKSPACE, SPACE, UP_ARROW, DOWN_ARROW,
    } = KeyCodes;

    if (keyCode === SPACE && target !== this.input) {
      event.preventDefault();
      this.openDropdown();
    } else if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
      event.preventDefault();
      this.openDropdown();
    } else if (keyCode === BACKSPACE && Util.allowsMultipleSelections(this.props) && !this.state.searchValue && value.length > 0) {
      this.props.onDeselect(value[value.length - 1]);
    } else if (keyCode === KeyCodes.ESCAPE) {
      this.closeDropdown();
    }
  }

  /**
   * Handles the mouse down events.
   * @param {event} event - The mouse down event.
   */
  handleMouseDown(event) {
    if (this.props.variant !== Variants.DEFAULT) {
      // Preventing default events stops the search input from losing focus.
      // The default variant has no search input therefore the mouse down gives the component focus.
      event.preventDefault();
    }
    this.openDropdown(event);
  }

  /**
   * Handles the input mouse down events.
   * @param {event} event - The mouse down event.
   */
  handleInputMouseDown(event) {
    event.stopPropagation();
    this.openDropdown(event);
  }

  handleInputFocus() {
    this.setState({ isInputFocused: true });
  }

  handleInputBlur() {
    this.setState({ isInputFocused: false });
  }

  /**
   * Handles click event on toggle button
   */
  handleButtonClick() {
    // If default variant, don't do custom event handling, use default event handling
    if (this.props.variant === Variants.DEFAULT) {
      return;
    }

    this.openDropdown();

    if (document.querySelector(this.selectListBox)) {
      document.querySelector(this.selectListBox).focus();
    }
  }

  /**
   * Handles changes to the search value.
   * @param {event} event - The input change event.
   */
  handleSearch(event) {
    const searchValue = event.target.value;

    this.setState({
      isOpen: true,
      hasSearchChanged: true,
      searchValue,
    });

    if (this.props.onSearch) {
      this.props.onSearch(searchValue);
    }
  }

  /**
   * Handles the request to select an option.
   * @param {string|number} value - The value of the selected option.
   * @param {ReactNode} option - The option that was selected.
   */
  handleSelect(value, option) {
    const { isAbove } = this.state;
    const isOpen = Util.allowsMultipleSelections(this.props);

    this.setState({
      searchValue: '',
      hasSearchChanged: false,
      isOpen,
      isAbove: isOpen ? isAbove : false,
    });

    if (this.props.onSelect) {
      this.props.onSelect(value, option);
    }
  }

  /**
   * Toggles the dropdown open or closed.
   */
  toggleDropdown() {
    if (this.state.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  renderToggleButton() {
    const { variant } = this.props;

    if (variant !== Variants.DEFAULT && this.state.isInputFocused) {
      return (
        <div className={cx('toggle')} onMouseDown={this.toggleDropdown}>
          <span className={cx('arrow-icon')} />
        </div>
      );
    }

    if (variant !== Variants.DEFAULT && this.state.isFocused !== true) {
      return (
        <div className={cx(['toggle', 'toggle-narrow'])}>
          <button
            type="button"
            className={cx('toggle-btn')}
            onClick={this.handleButtonClick}
            aria-label="Click to navigate to options"
            data-terra-form-select-toggle-button
          >
            <span className={cx('arrow-icon')} data-terra-form-select-toggle-button-icon />
          </button>
        </div>
      );
    }

    return (
      <div className={cx('toggle')} onMouseDown={this.toggleDropdown}>
        <span className={cx('arrow-icon')} />
      </div>
    );
  }

  render() {
    const {
      disabled,
      display,
      dropdown,
      dropdownAttrs,
      isInvalid,
      maxHeight,
      noResultContent,
      onDeselect,
      onSearch,
      onSelect,
      optionFilter,
      placeholder,
      variant,
      value,
      ...customProps
    } = this.props;

    const selectClasses = cx([
      'select',
      variant,
      { 'is-above': this.state.isAbove },
      { 'is-disabled': disabled },
      { 'is-focused': this.state.isFocused },
      { 'is-invalid': isInvalid },
      { 'is-open': this.state.isOpen },
      customProps.className,
    ]);

    return (
      <div
        {...customProps}
        className={selectClasses}
        onBlur={this.handleBlur}
        onFocus={this.handleFocus}
        onKeyDown={this.handleKeyDown}
        onMouseDown={this.handleMouseDown}
        tabIndex={Util.tabIndex(this.props)}
        ref={(select) => { this.select = select; }}
      >
        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}

        <div
          role={!disabled ? 'combobox' : undefined}
          aria-controls={!disabled && this.state.isOpen ? 'terra-select-dropdown' : undefined}
          aria-disabled={!!disabled}
          aria-owns={this.state.isOpen ? 'terra-select-dropdown' : undefined}
          aria-expanded={!!disabled && !!this.state.isOpen}
          aria-haspopup={!disabled ? 'true' : undefined}
          aria-label="Search label"
          aria-describedby="screen-reader-text"
          className={cx('display')}
          onMouseDown={this.openDropdown}
        >
          <span id="screen-reader-text" className={cx('visually-hidden-component')}>Use up and down arrow keys to navigate through options. On a mobile device, swipe right to navigate options</span>
          {this.getDisplay()}
        </div>
        {this.renderToggleButton()}
        <span className={cx('visually-hidden-component')} ref={this.visuallyHiddenComponent} aria-live="polite" aria-relevant="additions text" aria-atomic="true" />
        {this.state.isOpen
          && (
          <Dropdown
            {...dropdownAttrs}
            id={this.state.isOpen ? 'terra-select-dropdown' : undefined}
            target={this.select}
            isAbove={this.state.isAbove}
            isEnabled={this.state.isPositioned}
            onResize={this.positionDropdown}
            refCallback={(ref) => { this.dropdown = ref; }}
            style={Util.dropdownStyle(dropdownAttrs, this.state)}
          >
            {dropdown
              && dropdown({
                value,
                variant,
                onDeselect,
                optionFilter,
                noResultContent,
                visuallyHiddenComponent: this.visuallyHiddenComponent,
                onSelect: this.handleSelect,
                onRequestClose: this.closeDropdown,
                searchValue: this.state.searchValue,
                input: this.input,
                select: this.select,
              })}
          </Dropdown>
          )
        }
      </div>
    );
  }
}

Frame.propTypes = propTypes;
Frame.defaultProps = defaultProps;

export default Frame;
