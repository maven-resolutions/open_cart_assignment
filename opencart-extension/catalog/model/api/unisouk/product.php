<?php
/**
 * Bridges catalog API controllers to OpenCart admin product writes.
 *
 * Catalog ModelCatalogProduct is read-only; add/edit/delete live in
 * admin/model/catalog/product.php. This wrapper loads the admin model once
 * per request without loading the catalog product model first (same class name).
 */
class ModelApiUnisoukProduct extends Model {
	/** @var ModelCatalogProduct|null */
	private $adminProductModel = null;

	private function getAdminProductModel() {
		if ($this->adminProductModel !== null) {
			return $this->adminProductModel;
		}

		if (class_exists('ModelCatalogProduct', false)) {
			$probe = new ModelCatalogProduct($this->registry);

			if (method_exists($probe, 'addProduct')) {
				$this->adminProductModel = $probe;
				return $this->adminProductModel;
			}

			trigger_error('UniSouk: catalog ModelCatalogProduct is loaded without addProduct(); cannot load admin write model.');
			return null;
		}

		$admin_model_path = DIR_APPLICATION . '../admin/model/catalog/product.php';

		if (!is_file($admin_model_path)) {
			trigger_error('UniSouk: admin product model not found at ' . $admin_model_path);
			return null;
		}

		require_once($admin_model_path);

		$this->adminProductModel = new ModelCatalogProduct($this->registry);

		return $this->adminProductModel;
	}

	public function addProduct($data) {
		$model = $this->getAdminProductModel();

		if (!$model) {
			return 0;
		}

		return (int)$model->addProduct($data);
	}

	public function editProduct($product_id, $data) {
		$model = $this->getAdminProductModel();

		if (!$model) {
			return false;
		}

		$model->editProduct((int)$product_id, $data);

		return true;
	}

	public function deleteProduct($product_id) {
		$model = $this->getAdminProductModel();

		if (!$model) {
			return false;
		}

		$model->deleteProduct((int)$product_id);

		return true;
	}

	public function getProduct($product_id) {
		$model = $this->getAdminProductModel();

		if (!$model) {
			return false;
		}

		return $model->getProduct((int)$product_id);
	}

	/**
	 * Build OpenCart admin product_option rows from API payload.
	 *
	 * @param array<int, array<string, mixed>> $options
	 * @return array<int, array<string, mixed>>
	 */
	public function buildProductOptions($options) {
		$product_options = array();

		foreach ($options as $option) {
			if (empty($option['name']) || empty($option['type']) || empty($option['values']) || !is_array($option['values'])) {
				continue;
			}

			$type = $option['type'];
			if ($type !== 'select' && $type !== 'radio') {
				continue;
			}

			$built = $this->buildSingleProductOption(
				(string)$option['name'],
				(string)$type,
				$option['values'],
			);

			if ($built) {
				$product_options[] = $built;
			}
		}

		return $product_options;
	}

	private function buildSingleProductOption($name, $type, $values) {
		$language_id = (int)$this->config->get('config_language_id');
		$option_id = $this->findOrCreateOptionId($name, $type, $language_id);

		if ($option_id <= 0) {
			return null;
		}

		$product_option_values = array();

		foreach ($values as $value) {
			if (empty($value['name'])) {
				continue;
			}

			$value_name = (string)$value['name'];
			$price_modifier = isset($value['priceModifier']) ? (float)$value['priceModifier'] : 0.0;
			$quantity = isset($value['quantity']) ? (int)$value['quantity'] : 0;
			$option_value_id = $this->findOrCreateOptionValueId(
				$option_id,
				$value_name,
				$language_id,
			);

			if ($option_value_id <= 0) {
				continue;
			}

			$product_option_values[] = array(
				'product_option_value_id' => '',
				'option_value_id'       => $option_value_id,
				'name'                  => $value_name,
				'quantity'              => $quantity,
				'subtract'              => 1,
				'price'                 => abs($price_modifier),
				'price_prefix'          => $price_modifier < 0 ? '-' : '+',
				'points'                => 0,
				'points_prefix'         => '+',
				'weight'                => 0,
				'weight_prefix'         => '+',
			);
		}

		if (!$product_option_values) {
			return null;
		}

		return array(
			'product_option_id'    => '',
			'option_id'            => $option_id,
			'name'                 => $name,
			'type'                 => $type,
			'required'             => 1,
			'product_option_value' => $product_option_values,
		);
	}

	private function findOrCreateOptionId($name, $type, $language_id) {
		$query = $this->db->query(
			"SELECT o.option_id FROM `" . DB_PREFIX . "option` o " .
			"LEFT JOIN `" . DB_PREFIX . "option_description` od ON (o.option_id = od.option_id) " .
			"WHERE od.name = '" . $this->db->escape($name) . "' " .
			"AND o.type = '" . $this->db->escape($type) . "' " .
			"AND od.language_id = '" . (int)$language_id . "' LIMIT 1"
		);

		if ($query->num_rows) {
			return (int)$query->row['option_id'];
		}

		$this->db->query(
			"INSERT INTO `" . DB_PREFIX . "option` SET type = '" . $this->db->escape($type) . "', sort_order = '1'"
		);

		$option_id = (int)$this->db->getLastId();

		$this->db->query(
			"INSERT INTO `" . DB_PREFIX . "option_description` SET option_id = '" . (int)$option_id . "', language_id = '" . (int)$language_id . "', name = '" . $this->db->escape($name) . "'"
		);

		return $option_id;
	}

	private function findOrCreateOptionValueId($option_id, $name, $language_id) {
		$query = $this->db->query(
			"SELECT ov.option_value_id FROM `" . DB_PREFIX . "option_value` ov " .
			"LEFT JOIN `" . DB_PREFIX . "option_value_description` ovd ON (ov.option_value_id = ovd.option_value_id) " .
			"WHERE ov.option_id = '" . (int)$option_id . "' " .
			"AND ovd.name = '" . $this->db->escape($name) . "' " .
			"AND ovd.language_id = '" . (int)$language_id . "' LIMIT 1"
		);

		if ($query->num_rows) {
			return (int)$query->row['option_value_id'];
		}

		$this->db->query(
			"INSERT INTO `" . DB_PREFIX . "option_value` SET option_id = '" . (int)$option_id . "', image = '', sort_order = '1'"
		);

		$option_value_id = (int)$this->db->getLastId();

		$this->db->query(
			"INSERT INTO `" . DB_PREFIX . "option_value_description` SET option_value_id = '" . (int)$option_value_id . "', language_id = '" . (int)$language_id . "', option_id = '" . (int)$option_id . "', name = '" . $this->db->escape($name) . "'"
		);

		return $option_value_id;
	}
}
