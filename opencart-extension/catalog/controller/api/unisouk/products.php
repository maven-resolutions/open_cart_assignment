<?php
class ControllerApiUnisoukProducts extends Controller {
	private function respond($json) {
		$this->response->addHeader('Content-Type: application/json');
		$this->response->setOutput(json_encode($json));
	}

	private function requireApiSession() {
		$this->load->language('api/unisouk/products');

		if (!isset($this->session->data['api_id'])) {
			$this->respond(array('error' => $this->language->get('error_permission')));
			return false;
		}

		return true;
	}

	private function mapProductRow($product) {
		if (!$product || !isset($product['product_id'])) {
			return null;
		}

		return array(
			'product_id'  => (int)$product['product_id'],
			'name'        => $product['name'],
			'model'       => $product['model'],
			'price'       => (float)$product['price'],
			'quantity'    => (int)$product['quantity'],
			'status'      => (int)$product['status'],
			'description' => isset($product['description']) ? $product['description'] : '',
		);
	}

	private function mapProduct($product_id) {
		$this->load->model('catalog/product');
		$product = $this->model_catalog_product->getProduct($product_id);

		return $this->mapProductRow($product);
	}

	private function loadWriteProductModel() {
		$this->load->model('api/unisouk/product');

		return $this->model_api_unisouk_product;
	}

	private function mapWriteProduct($product_id) {
		$row = $this->loadWriteProductModel()->getProduct($product_id);

		return $this->mapProductRow($row);
	}

	private function buildProductPayload($name, $model, $existing = null) {
		$language_id = (int)$this->config->get('config_language_id');

		$resolvedName = $name !== null ? $name : ($existing ? $existing['name'] : '');
		$resolvedModel = $model !== null ? $model : ($existing ? $existing['model'] : '');
		$resolvedDescription = isset($this->request->post['description'])
			? $this->request->post['description']
			: ($existing ? $existing['description'] : '');

		return array(
			'model'             => $resolvedModel,
			'sku'               => '',
			'upc'               => '',
			'ean'               => '',
			'jan'               => '',
			'isbn'              => '',
			'mpn'               => '',
			'location'          => '',
			'quantity'          => isset($this->request->post['quantity'])
				? (int)$this->request->post['quantity']
				: ($existing ? (int)$existing['quantity'] : 0),
			'minimum'           => 1,
			'subtract'          => 1,
			'stock_status_id'   => (int)$this->config->get('config_stock_status_id'),
			'date_available'    => date('Y-m-d'),
			'manufacturer_id'   => 0,
			'shipping'          => 1,
			'price'             => isset($this->request->post['price'])
				? (float)$this->request->post['price']
				: ($existing ? (float)$existing['price'] : 0),
			'points'            => 0,
			'weight'            => 0,
			'weight_class_id'   => (int)$this->config->get('config_weight_class_id'),
			'length'            => 0,
			'width'             => 0,
			'height'            => 0,
			'length_class_id'   => (int)$this->config->get('config_length_class_id'),
			'status'            => isset($this->request->post['status'])
				? (int)$this->request->post['status']
				: ($existing ? (int)$existing['status'] : 1),
			'tax_class_id'      => 0,
			'sort_order'        => 0,
			'product_description' => array(
				$language_id => array(
					'name'             => $resolvedName,
					'description'      => $resolvedDescription,
					'meta_title'       => $resolvedName,
					'meta_description' => '',
					'meta_keyword'     => '',
					'tag'              => '',
				),
			),
			'product_store'     => array(0),
			'product_attribute' => array(),
			'product_option'    => array(),
			'product_discount'  => array(),
			'product_special'   => array(),
			'product_image'     => array(),
			'product_download'  => array(),
			'product_category'  => array(),
			'product_filter'    => array(),
			'product_related'   => array(),
			'product_reward'    => array(),
			'product_layout'    => array(),
			'product_seo_url'   => array(),
			'product_recurring' => array(),
		);
	}

	public function index() {
		if (!$this->requireApiSession()) {
			return;
		}

		$this->load->model('catalog/product');

		$page  = isset($this->request->post['page']) ? max(1, (int)$this->request->post['page']) : 1;
		$limit = isset($this->request->post['limit']) ? max(1, (int)$this->request->post['limit']) : 20;
		$start = ($page - 1) * $limit;

		$filter_data = array(
			'start' => $start,
			'limit' => $limit,
		);

		$results = $this->model_catalog_product->getProducts($filter_data);
		$products = array();

		foreach ($results as $result) {
			$mapped = $this->mapProductRow($result);

			if ($mapped) {
				$products[] = $mapped;
			}
		}

		$this->respond(array(
			'success' => true,
			'data'    => array(
				'products' => $products,
				'total'    => (int)$this->model_catalog_product->getTotalProducts($filter_data),
			),
		));
	}

	public function info() {
		if (!$this->requireApiSession()) {
			return;
		}

		if (empty($this->request->post['product_id'])) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		$product = $this->mapProduct((int)$this->request->post['product_id']);

		if (!$product) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		$this->respond(array(
			'success' => true,
			'data'    => $product,
		));
	}

	private function parseOptionsFromPost() {
		if (!isset($this->request->post['options']) || $this->request->post['options'] === '') {
			return array();
		}

		$raw = $this->request->post['options'];

		if (is_array($raw)) {
			return $raw;
		}

		// OpenCart Request::clean() htmlspecialchars-encodes all POST scalars,
		// turning JSON quotes into &quot; — decode before json_decode.
		$raw = html_entity_decode(trim((string)$raw), ENT_QUOTES, 'UTF-8');
		$decoded = json_decode($raw, true);

		if (!is_array($decoded)) {
			return null;
		}

		return $decoded;
	}

	public function add() {
		if (!$this->requireApiSession()) {
			return;
		}

		$name = isset($this->request->post['name']) ? trim($this->request->post['name']) : '';
		$model = isset($this->request->post['model']) ? trim($this->request->post['model']) : '';

		if ($name === '' || $model === '') {
			$this->respond(array('error' => 'Product name and model are required'));
			return;
		}

		$options_payload = $this->parseOptionsFromPost();

		if ($options_payload === null) {
			$this->respond(array('error' => 'Invalid options payload — expected JSON array'));
			return;
		}

		$data = $this->buildProductPayload($name, $model);
		$writeModel = $this->loadWriteProductModel();

		if ($options_payload) {
			$product_options = $writeModel->buildProductOptions($options_payload);

			if (!$product_options) {
				$this->respond(array('error' => 'No valid product options were provided'));
				return;
			}

			$data['product_option'] = $product_options;
		}

		$product_id = $writeModel->addProduct($data);

		if ($product_id <= 0) {
			$this->respond(array('error' => $this->language->get('error_create_failed')));
			return;
		}

		$product = $this->mapProductRow($writeModel->getProduct($product_id));

		if (!$product) {
			$this->respond(array('error' => $this->language->get('error_create_failed')));
			return;
		}

		$this->respond(array(
			'success' => true,
			'data'    => $product,
		));
	}

	public function edit() {
		if (!$this->requireApiSession()) {
			return;
		}

		if (empty($this->request->post['product_id'])) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		$product_id = (int)$this->request->post['product_id'];
		$writeModel = $this->loadWriteProductModel();
		$existing = $this->mapProductRow($writeModel->getProduct($product_id));

		if (!$existing) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		$name = isset($this->request->post['name']) ? trim($this->request->post['name']) : null;
		$model = isset($this->request->post['model']) ? trim($this->request->post['model']) : null;
		$data = $this->buildProductPayload($name, $model, $existing);

		if (!$writeModel->editProduct($product_id, $data)) {
			$this->respond(array('error' => $this->language->get('error_update_failed')));
			return;
		}

		$product = $this->mapProductRow($writeModel->getProduct($product_id));

		if (!$product) {
			$this->respond(array('error' => $this->language->get('error_update_failed')));
			return;
		}

		$this->respond(array(
			'success' => true,
			'data'    => $product,
		));
	}

	public function delete() {
		if (!$this->requireApiSession()) {
			return;
		}

		if (empty($this->request->post['product_id'])) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		$product_id = (int)$this->request->post['product_id'];
		$writeModel = $this->loadWriteProductModel();

		if (!$this->mapProductRow($writeModel->getProduct($product_id))) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		if (!$writeModel->deleteProduct($product_id)) {
			$this->respond(array('error' => $this->language->get('error_delete_failed')));
			return;
		}

		$this->respond(array('success' => true));
	}

	public function options() {
		if (!$this->requireApiSession()) {
			return;
		}

		if (empty($this->request->post['product_id'])) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		$product_id = (int)$this->request->post['product_id'];
		$existing = $this->mapProduct($product_id);

		if (!$existing) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		$query = $this->db->query("SELECT po.product_option_id, po.option_id, od.name AS option_name, pov.product_option_value_id, ovd.name AS value_name, pov.quantity, pov.price, pov.price_prefix FROM `" . DB_PREFIX . "product_option` po LEFT JOIN `" . DB_PREFIX . "option` o ON (po.option_id = o.option_id) LEFT JOIN `" . DB_PREFIX . "option_description` od ON (o.option_id = od.option_id AND od.language_id = '" . (int)$this->config->get('config_language_id') . "') LEFT JOIN `" . DB_PREFIX . "product_option_value` pov ON (po.product_option_id = pov.product_option_id) LEFT JOIN `" . DB_PREFIX . "option_value` ov ON (pov.option_value_id = ov.option_value_id) LEFT JOIN `" . DB_PREFIX . "option_value_description` ovd ON (ov.option_value_id = ovd.option_value_id AND ovd.language_id = '" . (int)$this->config->get('config_language_id') . "') WHERE po.product_id = '" . (int)$product_id . "' ORDER BY po.option_id, pov.product_option_value_id");

		$options = array();

		foreach ($query->rows as $row) {
			if (!$row['product_option_value_id']) {
				continue;
			}

			$price_modifier = (float)$row['price'];
			if ($row['price_prefix'] === '-') {
				$price_modifier = -$price_modifier;
			}

			$options[] = array(
				'option_id'       => (int)$row['option_id'],
				'option_name'     => $row['option_name'],
				'option_value_id' => (int)$row['product_option_value_id'],
				'value_name'      => $row['value_name'],
				'price'           => $price_modifier,
				'quantity'        => (int)$row['quantity'],
			);
		}

		$this->respond(array(
			'success' => true,
			'data'    => array(
				'options' => $options,
			),
		));
	}
}
